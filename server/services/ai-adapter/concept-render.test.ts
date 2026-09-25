/**
 * Concept render path + currency tests.
 * Run with: npx tsx server/services/ai-adapter/concept-render.test.ts
 */
import type { InsertRender, QuizResponse, Render } from "@shared/schema";
import { orchestrateAiRender, type RenderOrchestratorStorage } from "./render-orchestrator.js";
import { CurrencyConverter, UnsupportedCurrencyError } from "../currency.js";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) console.log(`PASS: ${name}`);
  else { failures += 1; console.error(`FAIL: ${name} ${detail}`); }
};

process.env.CURALINA_AI_SERVICES_ENABLED = "true";
process.env.CURALINA_ROOMS_URL = "http://127.0.0.1:8103";
process.env.CURALINA_ROOM_RENDER_MODE = "concept";

const quiz = (o: Partial<QuizResponse> = {}) =>
  ({ id: "q1", roomType: "Living Room", styles: ["Organic Modern"], atmosphere: "Warm & Balanced",
     patternPreference: "Just Solids", ...o }) as QuizResponse;

function mockStorage(q: QuizResponse) {
  const created: InsertRender[] = [];
  const storage = {
    getQuizResponse: async () => q,
    getProduct: async () => { throw new Error("products must not be touched in concept mode"); },
    createRender: async (r: InsertRender) => { created.push(r); return { id: "r1", ...r } as unknown as Render; },
    createSelectionLedger: async () => { throw new Error("no ledger in concept mode"); },
  } as unknown as RenderOrchestratorStorage;
  return { storage, created };
}

async function withFetch<T>(impl: (url: string, init?: RequestInit) => Promise<Response>, fn: () => Promise<T>) {
  const orig = globalThis.fetch;
  globalThis.fetch = (async (i: RequestInfo | URL, init?: RequestInit) => impl(String(i), init)) as typeof fetch;
  try { return await fn(); } finally { globalThis.fetch = orig; }
}

async function main() {
  // 1. happy path
  {
    const { storage, created } = mockStorage(quiz());
    const calls: { url: string; body: any }[] = [];
    const out = await withFetch(async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ schema_version: "1.0", job_id: "job_1", status: "queued" }), { status: 202 });
    }, () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage }));
    const b = calls[0]?.body;
    check("concept: submits render_brief to rooms /v1/jobs",
      calls.length === 1 && calls[0].url.endsWith("/v1/jobs") && b.render_brief.room_type === "Living Room"
      && b.render_brief.style === "Organic Modern" && b.render_brief.atmosphere === "Warm & Balanced"
      && b.render_brief.pattern === "Just Solids" && b.render_brief.renderer === "sd15"
      && b.bundle === undefined && b.idempotency_key === "q1:s1");
    const ref = created[0]?.aiServiceRef as any;
    check("concept: 201 + generating row with aiServiceRef",
      out.status === 201 && created[0].status === "generating" && ref.jobId === "job_1"
      && ref.mode === "concept" && ref.renderer === "sd15", JSON.stringify(out));
  }
  // 2. missing atmosphere
  {
    const { storage, created } = mockStorage(quiz({ atmosphere: null }));
    let fetched = false;
    const out = await withFetch(async () => { fetched = true; return new Response("{}"); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage }));
    check("concept: missing atmosphere -> needs_input row, no rooms call",
      out.status === 201 && !fetched && created[0].status === "needs_input"
      && created[0].errorMessage === "needs_input: atmosphere");
    const bad = mockStorage(quiz({ styles: ["Bogus"] }));
    const o2 = await orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage: bad.storage });
    check("concept: non-canonical style -> needs_input styles", bad.created[0]?.errorMessage === "needs_input: styles" && o2.status === 201);
  }
  // 3. unreachable
  {
    const { storage, created } = mockStorage(quiz());
    const out = await withFetch(async () => { throw new TypeError("fetch failed"); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage }));
    check("concept: rooms unreachable -> flat 503, no row",
      out.status === 503 && created.length === 0 && typeof out.body.error === "string"
      && out.body.code === "ai_service_unavailable");
  }
  // 4. renderer selection
  {
    process.env.CURALINA_ROOM_RENDERER = "composite";
    const { storage, created } = mockStorage(quiz());
    let sent: any;
    await withFetch(async (_u, init) => { sent = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ schema_version: "1.0", job_id: "j2", status: "queued" })); },
      () => orchestrateAiRender({ quizResponseId: "q1", sessionId: "s1", storage }));
    check("concept: renderer from setting", sent.render_brief.renderer === "composite" && (created[0].aiServiceRef as any).renderer === "composite");
    delete process.env.CURALINA_ROOM_RENDERER;
  }
  // 5. currency
  {
    const c = new CurrencyConverter({ USD: 2 });
    let threw = false;
    try { c.convert(1, "CAD", "JPY"); } catch (e) { threw = e instanceof UnsupportedCurrencyError; }
    check("currency: CAD->USD override, unsupported throws typed error",
      c.convert(10, "USD", "CAD") === 20 && c.convert(10, "CAD", "CAD") === 10 && threw);
  }
  console.log(failures === 0 ? "ALL CONCEPT TESTS PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
