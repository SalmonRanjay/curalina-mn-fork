/**
 * AI adapter mapping tests (phase A5, packet 2 of 3)
 *
 * Run with: npx tsx server/services/ai-adapter/mapping.test.ts
 *
 * Hand-run script in the budget-allocation.test.ts / settings.test.ts
 * shape — this repository has no test runner configured (no vitest/jest).
 * Each named test prints a PASS/FAIL line and the script exits non-zero if
 * any test fails.
 */

import type { Product, QuizResponse } from "@shared/schema";
import {
  toDesignProfile,
  parseBudgetRangeToMinorUnits,
} from "./design-profile-mapper.js";
import {
  postRecommendations,
  RecommendationServiceError,
} from "./recommendation-client.js";
import {
  toAppProductRef,
  ProductMappingMismatchError,
} from "./product-response-mapper.js";

let failures = 0;

function pass(name: string, detail?: string) {
  console.log(`PASS: ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name: string, detail: string) {
  failures += 1;
  console.error(`FAIL: ${name} — ${detail}`);
}

// --- Fixtures -------------------------------------------------------------

function baseQuizResponse(overrides: Partial<QuizResponse> = {}): QuizResponse {
  return {
    id: "quiz-1",
    sessionId: "session-1",
    userId: null,
    roomType: "Living Room",
    styles: ["Midcentury Scandi"],
    colorPalettes: null,
    lineStyle: null,
    textures: null,
    lifestyleCue: null,
    patternPreference: null,
    keyFeatures: ["Comfortable Seat", "Storage"],
    budgetRange: "$2K-$5K",
    vibeImages: null,
    vibeBoardUrl: null,
    preferences: null,
    roomPhoto: null,
    floorplanUrl: null,
    vibeColorPalette: null,
    vibeMaterials: null,
    vibeTextures: null,
    vibeLightingTone: null,
    vibeDensity: null,
    vibeOverallDescription: null,
    roomDescription: null,
    parsedRoomData: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as QuizResponse;
}

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
    images: ["https://example.test/sofa.jpg"],
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

async function main() {
  // --- Test 1: full mapping success is not claimed ------------------------
  {
    const quizResponse = baseQuizResponse();
    const result = toDesignProfile(quizResponse);
    if (
      "needsInput" in result &&
      result.needsInput === true &&
      result.missingField === "atmosphere"
    ) {
      pass(
        "1. Full mapping success is not claimed",
        "otherwise-complete fixture (roomType/styles/budgetRange/keyFeatures all present) " +
          "returns needsInput naming atmosphere, since no quiz field supplies it"
      );
    } else {
      fail(
        "1. Full mapping success is not claimed",
        `expected needsInput naming atmosphere, got ${JSON.stringify(result)}`
      );
    }
  }

  // --- Test 2: budget midpoint conversion ----------------------------------
  {
    const minorUnits = parseBudgetRangeToMinorUnits("$2K-$5K");
    if (minorUnits === 350000 && Number.isInteger(minorUnits)) {
      pass("2. Budget midpoint conversion", '"$2K-$5K" -> 350000 exactly (integer)');
    } else {
      fail(
        "2. Budget midpoint conversion",
        `expected exactly the integer 350000, got ${JSON.stringify(minorUnits)}`
      );
    }
  }

  // --- Test 3: empty categories rejected -----------------------------------
  {
    const quizResponse = baseQuizResponse({ keyFeatures: [] });
    const result = toDesignProfile(quizResponse);
    if (
      "needsInput" in result &&
      result.needsInput === true &&
      result.missingField === "categories"
    ) {
      pass("3. Empty categories rejected", "keyFeatures=[] returns needsInput naming categories");
    } else {
      fail(
        "3. Empty categories rejected",
        `expected needsInput naming categories, got ${JSON.stringify(result)}`
      );
    }
  }

  // --- Test 4: unparseable budget rejected ---------------------------------
  {
    const quizResponse = baseQuizResponse({ budgetRange: "call for pricing" });
    let threw = false;
    let result: ReturnType<typeof toDesignProfile> | undefined;
    try {
      result = toDesignProfile(quizResponse);
    } catch {
      threw = true;
    }
    if (
      !threw &&
      result &&
      "needsInput" in result &&
      result.needsInput === true &&
      result.missingField === "budgetRange"
    ) {
      pass(
        "4. Unparseable budget rejected",
        '"call for pricing" returns needsInput naming budgetRange, function does not throw'
      );
    } else {
      fail(
        "4. Unparseable budget rejected",
        `expected needsInput naming budgetRange without throwing, got threw=${threw}, result=${JSON.stringify(result)}`
      );
    }
  }

  // --- Test 5: product mapping omits trade price structurally -------------
  {
    const appProduct = baseAppProduct({ tradePrice: "150.00" });
    const result = toAppProductRef({ product_id: appProduct.id }, appProduct);
    const hasTradePrice = "tradePrice" in result;
    if (!hasTradePrice) {
      pass(
        "5. Product mapping omits trade price structurally",
        '"tradePrice" in result === false, even though the source appProduct has a non-null tradePrice'
      );
    } else {
      fail(
        "5. Product mapping omits trade price structurally",
        `expected "tradePrice" in result === false, got true (result=${JSON.stringify(result)})`
      );
    }
  }

  // --- Test 6: product mapping mismatch is rejected, not silently substituted
  {
    const appProduct = baseAppProduct({ id: "product-1" });
    let threw = false;
    let errorIsNamed = false;
    let missingProductId: string | undefined;
    try {
      toAppProductRef({ product_id: "product-does-not-exist" }, appProduct);
    } catch (error) {
      threw = true;
      if (error instanceof ProductMappingMismatchError) {
        errorIsNamed = true;
        missingProductId = error.productId;
      }
    }
    if (threw && errorIsNamed && missingProductId === "product-does-not-exist") {
      pass(
        "6. Product mapping mismatch is rejected, not silently substituted",
        `threw ProductMappingMismatchError naming productId="${missingProductId}"`
      );
    } else {
      fail(
        "6. Product mapping mismatch is rejected, not silently substituted",
        `expected a named ProductMappingMismatchError naming the missing product_id, got threw=${threw}, errorIsNamed=${errorIsNamed}, missingProductId=${missingProductId}`
      );
    }
  }

  // --- Test 7: client surfaces service error body verbatim -----------------
  {
    const errorBody = {
      code: "validation_error",
      message: "profile.style must not be blank",
      details: { field: "style" },
      retryable: false,
      request_id: "req-123",
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(errorBody), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    let threw = false;
    let matchesCodeAndMessage = false;
    try {
      await postRecommendations(
        {
          room_type: "Living Room",
          style: "Midcentury Scandi",
          atmosphere: "cozy",
          categories: ["Seating"],
          furniture_budget_minor_units: 350000,
          currency: "USD",
        },
        "snap_test"
      );
    } catch (error) {
      threw = true;
      if (
        error instanceof RecommendationServiceError &&
        error.code === errorBody.code &&
        error.message === errorBody.message
      ) {
        matchesCodeAndMessage = true;
      }
    } finally {
      globalThis.fetch = originalFetch;
    }

    if (threw && matchesCodeAndMessage) {
      pass(
        "7. Client surfaces service error body verbatim",
        `rejected with code="${errorBody.code}", message="${errorBody.message}" (not a generic "request failed")`
      );
    } else {
      fail(
        "7. Client surfaces service error body verbatim",
        `expected rejection carrying the mocked error body's code/message, got threw=${threw}, matchesCodeAndMessage=${matchesCodeAndMessage}`
      );
    }
  }

  console.log("");
  if (failures === 0) {
    console.log("ALL 7 NAMED TESTS PASSED");
    process.exit(0);
  } else {
    console.error(`${failures} TEST(S) FAILED`);
    process.exit(1);
  }
}

main();
