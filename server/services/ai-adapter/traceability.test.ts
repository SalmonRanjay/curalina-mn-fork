/**
 * AI adapter traceability tests (phase A5, packet 3 of 3)
 *
 * Run with: npx tsx server/services/ai-adapter/traceability.test.ts
 *
 * Hand-run script in the budget-allocation.test.ts / settings.test.ts /
 * mapping.test.ts shape — this repository has no test runner configured
 * (no vitest/jest). Each named test prints a PASS/FAIL line and the script
 * exits non-zero if any test fails.
 *
 * Named test 3 ("job submission requires typed asset refs") is a
 * compile-time assertion via `// @ts-expect-error` below, not a runtime
 * check — it is verified by `npm run check` (see this packet's completion
 * evidence for the with/without-the-line proof that this is real).
 */

import type { InsertRender, Product } from "@shared/schema";
import {
  importAssetToVariants,
  importAssetToRooms,
  type ProductImageBytes,
  type ProductImageFetcher,
} from "./asset-import.js";
import { submitVariantJob, type SubmitVariantJobParams } from "./render-job-client.js";
import {
  toAiServiceRef,
  toSelectionLedgerProvenance,
  type JobFixture,
  type CandidateFixture,
  type BundleFixture,
  type ReviewFixture,
  type BundleForProvenance,
} from "./provenance-mapper.js";

let failures = 0;

function pass(name: string, detail?: string) {
  console.log(`PASS: ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name: string, detail: string) {
  failures += 1;
  console.error(`FAIL: ${name} — ${detail}`);
}

// --- Fixtures ---------------------------------------------------------------

function baseAppProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "product-1",
    sku: "SKU-001",
    name: "Test Sofa",
    description: null,
    categoryId: "category-1",
    supplierId: "supplier-1",
    tradePrice: "199.99",
    price: "399.99",
    discount: "0",
    roomType: null,
    designStyle: null,
    styleTags: null,
    keyFeatures: null,
    storageSolutions: null,
    colors: null,
    materials: null,
    dimensions: null,
    weight: null,
    seating: null,
    assembly: null,
    inventory: null,
    leadTime: null,
    availability: "in_stock",
    shipping: null,
    images: ["https://curalina-cdn.example.test/products/SKU-001/front.jpg"],
    asset3dUrl: null,
    visualDescription: null,
    imageAnalyses: null,
    structuredAnalysis: null,
    visualDescriptionGemini: null,
    visualDescriptionFrontView: null,
    visualDescriptionFrontViewGemini: null,
    synthesizedFrontView: null,
    completeProductDescription: null,
    structuredAnalysisQuality: null,
    structuredAnalysisUpdatedAt: null,
    tags: null,
    sourceFile: null,
    seoMeta: null,
    slug: "test-sofa",
    imageHealth: "healthy",
    lastValidatedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as Product;
}

/** In-memory "storage backend" mock: returns real bytes without any
 * network call, and records how many times it was invoked. */
function createMockImageStorage(bytes: Uint8Array, mediaType: ProductImageBytes["mediaType"]) {
  let callCount = 0;
  const fetchImageBytes: ProductImageFetcher = async (_url: string) => {
    callCount += 1;
    return { bytes, mediaType };
  };
  return { fetchImageBytes, getCallCount: () => callCount };
}

interface CapturedFetchCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  bodyJson: any;
}

/** Mocks `globalThis.fetch`, capturing every call's parsed JSON body, and
 * answering with a fixed 201 JSON response shaped like `AssetRecord`. */
function installMockServiceFetch(responseBody: unknown, status = 201) {
  const calls: CapturedFetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawBody = init?.body;
    const bodyJson = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    calls.push({
      url: String(input),
      method: init?.method,
      headers: (init?.headers as Record<string, string>) ?? {},
      bodyJson,
    });
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/** True if `value` looks like a raw filesystem path or a bare
 * object-storage key that was never read into bytes — a `/`-rooted string,
 * a `Downloads`-containing string, or a Windows-style drive path. */
function looksLikeFilesystemPath(value: unknown): boolean {
  return (
    typeof value === "string" &&
    (value.startsWith("/") || value.includes("Downloads") || /^[A-Za-z]:\\/.test(value))
  );
}

function findFilesystemLikeField(obj: unknown, path = ""): string | null {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj === "string") {
    return looksLikeFilesystemPath(obj) ? path || "<root>" : null;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const hit = findFilesystemLikeField(obj[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof obj === "object") {
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const hit = findFilesystemLikeField(value, path ? `${path}.${key}` : key);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

async function main() {
  // --- Test 1: asset import never receives a bare path ---------------------
  {
    const pretendImageBytes = new TextEncoder().encode(
      "PRETEND_BINARY_IMAGE_BYTES_NOT_A_PATH_OR_KEY"
    );
    const storage = createMockImageStorage(pretendImageBytes, "image/jpeg");
    const mock = installMockServiceFetch({
      schema_version: "1.0",
      asset_id: "asset_test000001",
      content_hash: "sha256:" + "0".repeat(64),
    });

    let variantsResult;
    let roomsResult;
    try {
      variantsResult = await importAssetToVariants(baseAppProduct(), {
        fetchImageBytes: storage.fetchImageBytes,
      });
      // Rooms' fixture-stage /v1/assets is metadata-only (see
      // asset-import.ts docstring) — content_length only, no content_bytes.
      roomsResult = await importAssetToRooms(baseAppProduct(), {
        fetchImageBytes: storage.fetchImageBytes,
      });
    } finally {
      mock.restore();
    }

    const variantsCall = mock.calls[0];
    const roomsCall = mock.calls[1];

    const variantsHasContentBytes =
      typeof variantsCall?.bodyJson?.content_bytes === "string" &&
      variantsCall.bodyJson.content_bytes.length > 0;
    const variantsContentBytesDecodesToPretendBytes =
      Buffer.from(variantsCall?.bodyJson?.content_bytes ?? "", "base64").toString("utf-8") ===
      Buffer.from(pretendImageBytes).toString("utf-8");
    const roomsHasContentLength =
      typeof roomsCall?.bodyJson?.content_length === "number" &&
      roomsCall.bodyJson.content_length === pretendImageBytes.byteLength;

    const badFieldVariants = findFilesystemLikeField(variantsCall?.bodyJson);
    const badFieldRooms = findFilesystemLikeField(roomsCall?.bodyJson);

    if (
      !("needsInput" in (variantsResult as any)) &&
      !("needsInput" in (roomsResult as any)) &&
      variantsHasContentBytes &&
      variantsContentBytesDecodesToPretendBytes &&
      roomsHasContentLength &&
      !badFieldVariants &&
      !badFieldRooms
    ) {
      pass(
        "1. Asset import never receives a bare path",
        `variants body carries content_bytes decoding to the mock storage's actual bytes; rooms body carries content_length=${roomsCall?.bodyJson?.content_length}; no field in either outbound body resembles a filesystem path`
      );
    } else {
      fail(
        "1. Asset import never receives a bare path",
        `variantsHasContentBytes=${variantsHasContentBytes}, decodesCorrectly=${variantsContentBytesDecodesToPretendBytes}, roomsHasContentLength=${roomsHasContentLength}, badFieldVariants=${badFieldVariants}, badFieldRooms=${badFieldRooms}, variantsResult=${JSON.stringify(variantsResult)}, roomsResult=${JSON.stringify(roomsResult)}`
      );
    }
  }

  // --- Test 2: missing product image returns needsInput, not a fabricated asset
  {
    const storage = createMockImageStorage(new Uint8Array([1, 2, 3]), "image/png");
    const mock = installMockServiceFetch({
      schema_version: "1.0",
      asset_id: "asset_should_not_be_called",
      content_hash: "sha256:" + "0".repeat(64),
    });

    let result;
    try {
      result = await importAssetToVariants(baseAppProduct({ images: [] }), {
        fetchImageBytes: storage.fetchImageBytes,
      });
    } finally {
      mock.restore();
    }

    const isNeedsInput =
      result && "needsInput" in result && result.needsInput === true && result.sku === "SKU-001";

    if (isNeedsInput && storage.getCallCount() === 0 && mock.calls.length === 0) {
      pass(
        "2. Missing product image returns needsInput, not a fabricated asset",
        `needsInput naming sku="${(result as any).sku}"; fetchImageBytes call count=${storage.getCallCount()}; outbound HTTP call count=${mock.calls.length}`
      );
    } else {
      fail(
        "2. Missing product image returns needsInput, not a fabricated asset",
        `expected needsInput naming sku with zero fetch calls, got result=${JSON.stringify(result)}, fetchImageBytesCalls=${storage.getCallCount()}, httpCalls=${mock.calls.length}`
      );
    }
  }

  // --- Test 3: job submission requires typed asset refs (compile-time) -----
  {
    // sourceAssets must be AssetRef[], not a bare string — this is what
    // makes calling submitVariantJob with a raw local path a compile error
    // rather than a runtime bug. The @ts-expect-error directive below must
    // sit immediately above the one line it suppresses (TypeScript only
    // applies it to the very next line), so the bad value is assigned on
    // its own line rather than inline in a single call expression.
    const badParams: SubmitVariantJobParams = {
      parentProductId: "product-1",
      ownerId: "curalina_app",
      // @ts-expect-error sourceAssets must be AssetRef[], not a bare string.
      sourceAssets: "/Users/someone/Downloads/photo.jpg",
      maskId: "mask_1",
      targetColour: "walnut",
      idempotencyKey: "idem-1",
    };
    // Not awaited and not asserted at runtime — this test is purely a
    // compile-time assertion (see the @ts-expect-error above); the .catch
    // only prevents an unhandled-rejection warning from the real fetch()
    // this would otherwise attempt against a variants service that isn't
    // running in this script.
    submitVariantJob(badParams).catch(() => {});
    pass(
      "3. Job submission requires typed asset refs (compile-time)",
      "see the // @ts-expect-error line above this test, and this packet's completion evidence for the with/without-the-line npm run check proof"
    );
  }

  // --- Test 4: traceability round-trip --------------------------------------
  {
    const jobIdPattern = /^job_/;
    const candidateIdPattern = /^cand_/;

    const job: JobFixture = {
      schema_version: "1.0",
      job_id: "job_test0000001",
      status: "succeeded",
      candidate_id: "cand_test0000001",
    };
    const candidate: CandidateFixture = {
      schema_version: "1.0",
      candidate_id: "cand_test0000001",
      revision: 1,
      variant: {
        source_asset_id: "asset_source0001",
        output_asset_id: "asset_output0001",
      },
    };
    const bundle: BundleFixture = { bundle_id: "bundle_test0001", revision: 3 };
    const review: ReviewFixture = {
      schema_version: "1.0",
      review_id: "review_test0001",
      candidate_id: "cand_test0000001",
      revision: 1,
    };

    const record = toAiServiceRef(job, candidate, bundle, review);

    if (
      jobIdPattern.test(record.jobId) &&
      record.candidateId !== null &&
      candidateIdPattern.test(record.candidateId) &&
      record.schemaVersion === "1.0" &&
      record.bundleId === bundle.bundle_id &&
      record.bundleRevision === bundle.revision &&
      record.reviewId === review.review_id &&
      record.assetIds.includes("asset_source0001") &&
      record.assetIds.includes("asset_output0001")
    ) {
      pass(
        "4. Traceability round-trip",
        `jobId="${record.jobId}" matches ${jobIdPattern}, candidateId="${record.candidateId}" matches ${candidateIdPattern}, schemaVersion="${record.schemaVersion}"`
      );
    } else {
      fail("4. Traceability round-trip", `got ${JSON.stringify(record)}`);
    }
  }

  // --- Test 5: provenance mapper preserves rejection reasons ----------------
  {
    const bundle: BundleForProvenance = {
      bundle_id: "bundle_test0002",
      revision: 1,
      feasible: false,
      line_items: [
        {
          product_id: "product-1",
          category: "seating",
          quantity: 1,
          unit_price_minor_units: 39999,
          currency: "USD",
        },
      ],
      violations: [
        {
          code: "budget_exceeded",
          message: "Total exceeds furniture_budget_minor_units by 12000",
        },
      ],
      warnings: [],
    };

    const record = toSelectionLedgerProvenance(bundle, "rules_v3");
    const violation = record.selectionRationale.violations[0];

    if (
      record.selectionRationale.violations.length === 1 &&
      violation?.code === "budget_exceeded" &&
      violation?.message === "Total exceeds furniture_budget_minor_units by 12000"
    ) {
      pass(
        "5. Provenance mapper preserves rejection reasons",
        `code="${violation?.code}", message="${violation?.message}" carried through unchanged`
      );
    } else {
      fail(
        "5. Provenance mapper preserves rejection reasons",
        `expected the violation's code/message unchanged, got ${JSON.stringify(record.selectionRationale.violations)}`
      );
    }
  }

  // --- Test 6: renders.aiServiceRef is nullable and additive (compile-time) --
  {
    // This object literal deliberately omits `aiServiceRef`. If the schema
    // change in shared/schema.ts made that column required, this would fail
    // `npm run check` with a missing-property error — it must still satisfy
    // `InsertRender` with the field omitted.
    const renderInsertWithoutAiServiceRef: InsertRender = {
      quizResponseId: "quiz-1",
      sessionId: "session-1",
      userId: null,
      imageUrl: null,
      prompt: "a cozy living room",
      productSkus: ["SKU-001"],
      productPlacements: null,
      productMetadata: null,
      qaResults: null,
      parentRenderId: null,
      swappedSku: null,
      status: "generating",
      errorMessage: null,
    };
    void renderInsertWithoutAiServiceRef;
    pass(
      "6. renders.aiServiceRef is nullable and additive (compile-time)",
      "InsertRender object literal omitting aiServiceRef type-checks; see npm run check output in completion evidence"
    );
  }

  console.log("");
  if (failures === 0) {
    console.log("ALL 6 NAMED TESTS PASSED");
    process.exit(0);
  } else {
    console.error(`${failures} TEST(S) FAILED`);
    process.exit(1);
  }
}

main();
