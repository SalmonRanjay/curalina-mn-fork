import { curalinaStorage } from "../storage-curalina";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { InsertUploadJob, UploadJob, UploadJobFile } from "@shared/schema";
import crypto from "crypto";
// Visual analysis import moved to dynamic import based on feature flag

// AWS_REGION might be set to "global" which is invalid - default to us-east-1
const AWS_REGION = (process.env.AWS_REGION === "global" || !process.env.AWS_REGION) ? "us-east-1" : process.env.AWS_REGION;

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const S3_BUCKET = "curalina";
const BATCH_SIZE = 5; // Process 5 files at a time to avoid timeouts

interface FileToUpload {
  fileName: string;
  buffer: Buffer;
  contentType: string;
}

/**
 * Calculate SHA-256 hash of file buffer for duplicate detection
 */
function calculateFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Check if file already exists in S3
 */
async function checkFileExists(fileName: string): Promise<string | null> {
  try {
    const key = `products/${fileName}`;
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
    return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
  } catch (error: any) {
    if (error.name === "NotFound") {
      return null;
    }
    throw error;
  }
}

/**
 * Upload file to S3
 */
async function uploadFileToS3(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
  const key = `products/${fileName}`;
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Create a new upload job with initial file list
 * Marks duplicates up front before any processing
 */
export async function createUploadJob(
  productId: string,
  files: FileToUpload[],
  userId?: string
): Promise<UploadJob> {
  console.log(`Creating upload job for product ${productId} with ${files.length} files`);

  // Create the job record
  const job = await curalinaStorage.createUploadJob({
    productId,
    userId,
    status: "pending",
    totalFiles: files.length,
    completedFiles: 0,
    failedFiles: 0,
    skippedFiles: 0,
  });

  // Check for duplicates and create file records
  const fileRecords = await Promise.all(
    files.map(async (file) => {
      const fileHash = calculateFileHash(file.buffer);
      const existingUrl = await checkFileExists(file.fileName);
      
      return {
        jobId: job.id,
        fileName: file.fileName,
        fileSize: file.buffer.length,
        fileHash,
        status: existingUrl ? ("skipped" as const) : ("pending" as const),
        isDuplicate: !!existingUrl,
        s3Url: existingUrl || undefined,
      };
    })
  );

  await curalinaStorage.createUploadJobFiles(fileRecords);

  // Update job with skipped count
  const skippedCount = fileRecords.filter((f) => f.isDuplicate).length;
  
  // If ALL files are duplicates, mark job as completed immediately
  if (skippedCount === files.length && skippedCount > 0) {
    await curalinaStorage.updateUploadJob(job.id, { 
      skippedFiles: skippedCount,
      status: "completed",
      completedAt: new Date(),
    });
    console.log(`Upload job ${job.id} completed immediately - all ${skippedCount} files were duplicates`);
  } else if (skippedCount > 0) {
    await curalinaStorage.updateUploadJob(job.id, { skippedFiles: skippedCount });
    console.log(`Upload job ${job.id} created with ${skippedCount} duplicates skipped`);
  } else {
    console.log(`Upload job ${job.id} created with ${files.length} files to upload`);
  }
  
  return job;
}

/**
 * Process a single batch of files for a job
 * Returns true if more files remain to process
 */
export async function processUploadJobBatch(jobId: string, files: FileToUpload[]): Promise<boolean> {
  const job = await curalinaStorage.getUploadJob(jobId);
  if (!job) {
    throw new Error(`Upload job ${jobId} not found`);
  }

  // Update job status to processing
  if (job.status === "pending") {
    await curalinaStorage.updateUploadJob(jobId, { status: "processing" });
  }

  // Get pending files from database
  const pendingDbFiles = await curalinaStorage.getPendingUploadJobFiles(jobId);
  
  // Process next batch
  const batch = pendingDbFiles.slice(0, BATCH_SIZE);
  
  for (const dbFile of batch) {
    try {
      console.log(`Processing file ${dbFile.fileName} for job ${jobId}`);
      
      // Update current file in job
      await curalinaStorage.updateUploadJob(jobId, { currentFileName: dbFile.fileName });
      
      // Update file status to uploading
      await curalinaStorage.updateUploadJobFile(dbFile.id, { status: "uploading" });
      
      // Find matching file buffer
      const fileToUpload = files.find((f) => f.fileName === dbFile.fileName);
      if (!fileToUpload) {
        throw new Error(`File buffer not found for ${dbFile.fileName}`);
      }
      
      // Upload to S3
      const s3Url = await uploadFileToS3(dbFile.fileName, fileToUpload.buffer, fileToUpload.contentType);
      
      // Update file as completed
      await curalinaStorage.updateUploadJobFile(dbFile.id, {
        status: "completed",
        s3Url,
        uploadedAt: new Date(),
      });
      
      // Update job progress
      const updatedJob = await curalinaStorage.getUploadJob(jobId);
      if (updatedJob) {
        await curalinaStorage.updateUploadJob(jobId, {
          completedFiles: updatedJob.completedFiles + 1,
        });
      }
      
      console.log(`Successfully uploaded ${dbFile.fileName}`);
    } catch (error) {
      console.error(`Failed to upload ${dbFile.fileName}:`, error);
      
      // Update file as failed
      await curalinaStorage.updateUploadJobFile(dbFile.id, {
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      
      // Update job failed count
      const updatedJob = await curalinaStorage.getUploadJob(jobId);
      if (updatedJob) {
        await curalinaStorage.updateUploadJob(jobId, {
          failedFiles: updatedJob.failedFiles + 1,
        });
      }
    }
  }
  
  // Check if all files are processed
  const remainingFiles = await curalinaStorage.getPendingUploadJobFiles(jobId);
  const hasMore = remainingFiles.length > 0;
  
  if (!hasMore) {
    // Job completed
    const finalJob = await curalinaStorage.getUploadJob(jobId);
    if (finalJob) {
      await curalinaStorage.updateUploadJob(jobId, {
        status: finalJob.failedFiles > 0 ? "failed" : "completed",
        completedAt: new Date(),
        currentFileName: null,
      });
      
      // Update product images
      await updateProductImages(finalJob.productId, jobId);
    }
  }
  
  return hasMore;
}

/**
 * Update product's images array with successfully uploaded files
 */
async function updateProductImages(productId: string, jobId: string): Promise<void> {
  const files = await curalinaStorage.getUploadJobFiles(jobId);
  const successfulUploads = files
    .filter((f) => f.status === "completed" && f.s3Url)
    .map((f) => f.s3Url!);
  
  if (successfulUploads.length > 0) {
    const product = await curalinaStorage.getProduct(productId);
    if (product) {
      const existingImages = product.images || [];
      const newImages = [...existingImages, ...successfulUploads];
      await curalinaStorage.updateProduct(productId, { images: newImages });
      console.log(`Updated product ${productId} with ${successfulUploads.length} new images`);
      
      // Auto-trigger visual analysis for products with new images if they don't have descriptions
      if (!product.visualDescription) {
        try {
          // Import configuration and check feature flag
          const visualAnalysisConfig = (await import('../config/visual-analysis')).default;
          const servicePath = visualAnalysisConfig.useV2 
            ? './visual-analysis-job-service-v2'
            : './visual-analysis-job-service';
          
          const { createVisualAnalysisJob } = await import(servicePath);
          
          const analysisJob = await createVisualAnalysisJob(
            null, // userId (null for system-triggered jobs)
            "auto_after_upload", // jobType
            jobId, // uploadJobId
            { productIds: [productId] } // filters
          );
          console.log(`Auto-triggered visual analysis job ${analysisJob.id} for product ${productId} after upload (${visualAnalysisConfig.useV2 ? 'V2' : 'V1'})`);
        } catch (error) {
          console.error(`Failed to auto-trigger visual analysis for product ${productId}:`, error);
          // Don't fail the upload job if visual analysis trigger fails
        }
      }
    }
  }
}

/**
 * Get job status with progress information
 */
export async function getJobStatus(jobId: string) {
  const job = await curalinaStorage.getUploadJob(jobId);
  if (!job) {
    return null;
  }
  
  const files = await curalinaStorage.getUploadJobFiles(jobId);
  
  return {
    job,
    files,
    progress: {
      total: job.totalFiles,
      completed: job.completedFiles,
      failed: job.failedFiles,
      skipped: job.skippedFiles,
      pending: job.totalFiles - job.completedFiles - job.failedFiles - job.skippedFiles,
      percentage: job.totalFiles > 0 
        ? Math.round(((job.completedFiles + job.failedFiles + job.skippedFiles) / job.totalFiles) * 100)
        : 0,
    },
  };
}

/**
 * Resume a paused or failed job
 */
export async function resumeUploadJob(jobId: string, files: FileToUpload[]): Promise<void> {
  const job = await curalinaStorage.getUploadJob(jobId);
  if (!job) {
    throw new Error(`Upload job ${jobId} not found`);
  }
  
  // Update job status back to processing
  await curalinaStorage.updateUploadJob(jobId, { 
    status: "processing",
    errorMessage: null,
  });
  
  // Process remaining files
  let hasMore = true;
  while (hasMore) {
    hasMore = await processUploadJobBatch(jobId, files);
  }
}
