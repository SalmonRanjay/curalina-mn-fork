/**
 * Concept render with the consultation recommender in front (ADR-0025).
 * Run with: npx tsx server/services/ai-adapter/consultation-render.test.ts
 */
import type {
  Category,
  InsertCategory,
  InsertProduct,
  InsertRender,
  InsertSupplier,
  Product,
  QuizResponse,
  Render,
  Supplier,
} from "@shared/schema";
import type { RenderProductPlacement } from "@shared/render-placements";
import { orchestrateAiRender, type RenderOrchestratorStorage } from "./render-orchestrator.js";
import { toConsultationAnswers } from "./consultation-answers-mapper.js";
import { syncRecommendedProducts } from "./recommended-product-sync.js";
import type { ConsultationRecommendationShape } from "./recommendation-client.js";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) console.log(`PASS: ${name}`);
  else { failures += 1; console.error(`FAIL: ${name} ${detail}`); }
};

process.env.CURALINA_AI_SERVICES_ENABLED = "true";
process.env.CURALINA_RECOMMENDATION_URL = "http://rec:8101";
process.env.CURALINA_ROOMS_URL = "http://rooms:8103";
process.env.CURALINA_ROOM_RENDER_MODE = "concept";
process.env.CURALINA_ROOM_RENDERER = "composite";
process.env.CURALINA_RECOMMENDATION_IN_RENDER = "true";

const quiz = (o: Partial<QuizResponse> = {}) =>
  ({
    id: "q1", roomType: "Dining Room", styles: ["Contemporary Luxe"], materiality: "Organic Modern",
    atmosphere: "Dark & Moody", patternPreference: "Patterned Accents",
    keyFeatures: ["Refined space for hosting and socializing"], seatingCapacity: 8, bedSize: "",
    budgetRange: "$41,000-$50,000", ...o,
  }) as QuizResponse;

const product = (id: string, name: string, supplier: string, category: string, price: number | null) => ({
  product_id: id, supplier, sku: supplier === "Celadon" ? id.split(":")[1] : null, name, category,
  unit_price_minor_units: price, match_score: 0.9, rule_match: true,
  rooms: ["Dining Room"], styles: ["Organic Modern"], atmospheres: ["Dark & Moody"],
});

const RECOMMENDATION: ConsultationRecommendationShape = {
  schema_version: "1.0", status: "ok", problems: [], room_type: "Dining Room", currency: "CAD",
  placements: [
    { slot_id: "dining_table", tier: "foundation", label: "Dining table", quantity: 1, quantity_source: "one per slot",
      line_total_minor_units: 1385750, product: product("Luxus:row622", "Raya Dining Table", "Luxus", "Dining Table", 1385750) },
    { slot_id: "dining_chairs", tier: "bridge", label: "Dining chairs", quantity: 8, quantity_source: "seating answer",
      line_total_minor_units: 1114400, product: product("Lazzoni:row98", "ENA CHAIR", "Lazzoni", "Dining Chair", 139300) },
  ],
  alternatives: {}, total_minor_units: 2500150, budget_ceiling_minor_units: 5000000,
  notes: ["pattern density does not affect the products: the catalogue has no pattern data"],
  not_in_catalogue: ["Centerpieces"], plan_source: "Design Manual §4.2 The Object Hierarchy, p.96-97",
  model: { family: "consultation-two-tower", weights_sha256: "f".repeat(64), trained_run: "run_x", min_match_score: 0.5 },
  catalogue_fingerprint: "c".repeat(64), products_scored: 910, model_rule_disagreements: 3,
};

function mockStorage(q: QuizResponse, existing: Product[] = []) {
  const created: InsertRender[] = [];
  const products = new Map<string, Product>(existing.map((p) => [p.sku, p]));
  const suppliers: Supplier[] = [];
  const categories: Category[] = [];
  const writes = { products: 0, updates: 0 };
  const storage: RenderOrchestratorStorage = {
    getQuizResponse: async () => q,
    getProduct: async () => undefined,
    createRender: async (r: InsertRender) => { created.push(r); return { id: "r1", ...r } as unknown as Render; },
    createSelectionLedger: async () => { throw new Error("no ledger in concept mode"); },
    getProductBySku: async (sku: string) => products.get(sku),
    createProduct: async (p: InsertProduct) => {
      writes.products += 1;
      const row = { id: `app-${p.sku}`, ...p } as unknown as Product;
      products.set(p.sku, row);
      return row;
    },
    updateProduct: async (id: string, p: Partial<InsertProduct>) => {
      writes.updates += 1;
      const prev = Array.from(products.values()).find((x) => x.id === id)!;
      const row = { ...prev, ...p } as Product;
      products.set(row.sku, row);
      return row;
    },
    getSupplierByName: async (n: string) => suppliers.find((s) => s.name === n),
    createSupplier: async (s: InsertSupplier) => { const row = { id: `sup-${s.name}`, ...s } as unknown as Supplier; suppliers.push(row); return row; },
    getCategoryByName: async (n: string) => categories.find((c) => c.name === n),
    createCategory: async (c: InsertCategory) => { const row = { id: `cat-${c.name}`, ...c } as unknown as Category; categories.push(row); return row; },
  };
  return { storage, created, products, suppliers, categories, writes };
}

async function withFetch<T>(impl: (url: string, init?: RequestInit) => Promise<Response>, fn: () => Promise<T>) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (i: RequestInfo | URL, init?: RequestInit) => impl(String(i), init)) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

const roomsQueued = () => new Response(JSON.stringify({ schema_version: "1.0", job_id: "job_1", status: "queued" }), { status: 202 });

async function main() {
  // 1. happy path: recommend -> sync -> brief.products -> render row
  {
    const m = mockStorage(quiz());
    const calls: { url: string; body: any }[] = [];
    const out = await withFetch(async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return url.includes("/v1/consultation/recommendations")
        ? new Response(JSON.stringify(RECOMMENDATION), { status: 200 })
        : roomsQueued();
    }, () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));

    const [rec, rooms] = calls;
    check("recommendation is called first with the stored quiz answers",
      calls.length === 2 && rec.url === "http://rec:8101/v1/consultation/recommendations"
      && rec.body.answers.aesthetic === "Contemporary Luxe" && rec.body.answers.materiality === "Organic Modern"
      && rec.body.answers.seating_capacity === 8 && rec.body.answers.bed_size === null
      && rec.body.answers.investment === "$41,000-$50,000", JSON.stringify(rec?.body));
    const products = rooms?.body.render_brief.products;
    check("rooms brief carries the placed products",
      rooms.url.endsWith("/v1/render-jobs") && products.length === 2
      && products[0].product_id === "Luxus:row622" && products[1].quantity === 8
      && products[1].supplier === "Lazzoni", JSON.stringify(products));
    const row = m.created[0];
    const placements = row.productPlacements as RenderProductPlacement[];
    check("render row stores placements, skus and the recommendation summary",
      out.status === 201 && row.status === "generating"
      && JSON.stringify(row.productSkus) === JSON.stringify(["Luxus:row622", "Lazzoni:row98"])
      && placements[1].appProductId === "app-Lazzoni:row98" && placements[1].lineTotalMinorUnits === 1114400
      && (row.aiServiceRef as any).recommendation.modelRun === "run_x"
      && (row.aiServiceRef as any).mode === "concept", JSON.stringify(row));
    check("products, suppliers and categories are created for the cart",
      m.writes.products === 2 && m.suppliers.length === 2 && m.categories.length === 2
      && m.products.get("Luxus:row622")?.price === "13857.50" && m.suppliers[0].email === "");
  }
  // 2. needs_input from recommendation -> needs_input row, rooms not called
  {
    const m = mockStorage(quiz({ materiality: null }));
    const urls: string[] = [];
    const out = await withFetch(async (url) => {
      urls.push(url);
      return new Response(JSON.stringify({ ...RECOMMENDATION, status: "needs_input", problems: ["materiality: missing"], placements: [] }));
    }, () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));
    check("recommendation needs_input -> needs_input row, no rooms job",
      out.status === 201 && urls.length === 1 && m.created[0].status === "needs_input"
      && m.created[0].errorMessage === "needs_input: materiality: missing");
  }
  // 3. recommendation unreachable -> 503, no row
  {
    const m = mockStorage(quiz());
    const out = await withFetch(async () => { throw new TypeError("fetch failed"); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));
    check("recommendation unreachable -> flat 503 naming recommendation, no row",
      out.status === 503 && m.created.length === 0 && out.body.service === "recommendation");
  }
  // 4. a pre-Consultation feature string is needs_input before any network call
  {
    const m = mockStorage(quiz({ keyFeatures: ["Comfortable Seat"] }));
    let fetched = false;
    await withFetch(async () => { fetched = true; return roomsQueued(); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));
    check("legacy keyFeatures -> needs_input, nothing sent",
      !fetched && m.created[0].errorMessage?.startsWith("needs_input: keyFeatures") === true);
  }
  // 5. service error passes through
  {
    const m = mockStorage(quiz());
    const out = await withFetch(async () => new Response(JSON.stringify({
      code: "catalogue_not_configured", message: "CURALINA_SUPPLIER_DATA_DIR is not set",
      details: {}, retryable: false, request_id: "req_1" }), { status: 503 }),
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));
    check("recommendation 503 code passes through flat", out.status === 503
      && out.body.code === "catalogue_not_configured" && typeof out.body.error === "string" && m.created.length === 0);
  }
  // 6. sync updates an existing product instead of duplicating it
  {
    const existing = { id: "app-old", sku: "Luxus:row622", price: "1.00" } as Product;
    const m = mockStorage(quiz(), [existing]);
    const synced = await syncRecommendedProducts(m.storage, [RECOMMENDATION.placements[0].product,
      RECOMMENDATION.placements[0].product, product("Luxus:row1", "Unpriced", "Luxus", "Sofa", null)], "src");
    check("sync: update existing, de-duplicate, skip unpriced",
      m.writes.updates === 1 && m.writes.products === 0 && synced.size === 1
      && synced.get("Luxus:row622")?.id === "app-old" && synced.get("Luxus:row622")?.price === "13857.50");
  }
  // 7. mapper
  {
    const mapped = toConsultationAnswers(quiz({ bedSize: "King Size Bed", seatingCapacity: null, roomType: "Bedroom" }));
    check("mapper passes stored strings through, blanks become null",
      "answers" in mapped && mapped.answers.bed_size === "King Size Bed" && mapped.answers.seating_capacity === null
      && toConsultationAnswers(quiz({ materiality: "  " })).hasOwnProperty("answers")
      && (toConsultationAnswers(quiz({ materiality: "  " })) as any).answers.materiality === null);
  }
  // 8. flag off keeps the previous concept-only behaviour
  {
    process.env.CURALINA_RECOMMENDATION_IN_RENDER = "false";
    const m = mockStorage(quiz());
    const urls: string[] = [];
    await withFetch(async (url) => { urls.push(url); return roomsQueued(); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: m.storage }));
    check("flag off: rooms only, no products in brief or row",
      urls.length === 1 && urls[0].startsWith("http://rooms:8103") && m.created[0].productPlacements === null);
  }
  console.log(failures === 0 ? "ALL CONSULTATION RENDER TESTS PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
