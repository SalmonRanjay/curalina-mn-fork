// Migrate all images from AWS S3 to Google Cloud Storage
// Usage: node scripts/migrate-s3-to-gcs.js

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// AWS S3 config
const AWS_BUCKET = process.env.AWS_S3_BUCKET || 'curalina';
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// GCS config
const GCS_BUCKET = process.env.GCS_BUCKET || 'curalina-gcs';
const GCS_PROJECT = process.env.GCLOUD_PROJECT;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('Missing AWS credentials.');
  process.exit(1);
}

if (!GCS_BUCKET) {
  console.error('Missing GCS bucket name.');
  process.exit(1);
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const gcs = new Storage({ projectId: GCS_PROJECT });
const bucket = gcs.bucket(GCS_BUCKET);

async function listAllS3Objects(prefix = '') {
  let objects = [];
  let continuationToken;
  do {
    const command = new ListObjectsV2Command({
      Bucket: AWS_BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);
    if (response.Contents) {
      objects.push(...response.Contents.map(obj => obj.Key));
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);
  return objects;
}

async function downloadS3Object(key) {
  const command = new GetObjectCommand({ Bucket: AWS_BUCKET, Key: key });
  const response = await s3.send(command);
  return response.Body;
}

async function uploadToGCS(key, stream) {
  return new Promise((resolve, reject) => {
    const file = bucket.file(key);
    const writeStream = file.createWriteStream();
    stream.pipe(writeStream)
      .on('error', reject)
      .on('finish', resolve);
  });
}

async function migrate() {
  console.log('Listing S3 objects...');
  const objects = await listAllS3Objects('products/');
  console.log(`Found ${objects.length} objects.`);
  for (const key of objects) {
    console.log(`Migrating: ${key}`);
    const s3Stream = await downloadS3Object(key);
    await uploadToGCS(key, s3Stream);
    console.log(`Uploaded to GCS: ${key}`);
  }
  console.log('Migration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
