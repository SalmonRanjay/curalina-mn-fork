/**
 * Render reconciler tests. Run with:
 *   npx tsx server/services/ai-adapter/render-reconciler.test.ts
 */
import type { InsertRender, Render } from "@shared/schema";
import { reconcileOnce } from "./render-reconciler.js";
import type { RoomJobStatus } from "./render-job-client.js";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) console.log(`PASS: ${name}`);
  else { failures += 1; console.error(`FAIL: ${name} ${detail}`); }
};

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);
const NOW = Date.parse("2026-01-01T01:00:00Z");
const row = (id: string, createdAt = new Date(NOW - 1000)) =>
  ({ id, status: "generating", createdAt, aiServiceRef: { jobId: `job_${id}`, renderer: "sd15", mode: "concept" } }) as unknown as Render;
const job = (status: string, extra: Partial<RoomJobStatus> = {}): RoomJobStatus =>
  ({ status, attemptCount: 1, result: null, error: null, ...extra });
const ok = (): RoomJobStatus => job("succeeded", { result: { outputAssetId: "asset_1", renderer: "sd15", modelId: "m", label: "Concept preview. Not your room." } });

async function run(r: Render, getJob: () => Promise<RoomJobStatus>, fetchAsset?: () => Promise<any>) {
  const updates: Partial<InsertRender>[] = [];
  await reconcileOnce({
    storage: { getGeneratingAiRenders: async () => [r], updateRender: async (_id, d) => { updates.push(d); return r; } },
    getJob, fetchAsset: fetchAsset ?? (async () => ({ found: true, bytes: PNG, contentType: "image/png" })),
    now: () => NOW, log: () => {},
  });
  return updates;
}

async function main() {
  let u = await run(row("a"), async () => ok());
  const ref = (u[0]?.aiServiceRef ?? {}) as any;
  check("succeeded + PNG -> completed with imageUrl and asset info",
    u.length === 1 && u[0].status === "completed" && u[0].imageUrl === "/api/render/a/image"
    && ref.assetId === "asset_1" && ref.label === "Concept preview. Not your room." && ref.modelId === "m" && ref.jobId === "job_a");

  u = await run(row("b"), async () => ok(), async () => ({ found: false, httpStatus: 404 }));
  check("succeeded but bytes missing -> failed, never completed", u.length === 1 && u[0].status === "failed");

  u = await run(row("c"), async () => ok(), async () => ({ found: true, bytes: Buffer.from("not a png at all"), contentType: "image/png" }));
  check("succeeded but not a PNG -> failed", u[0]?.status === "failed");

  u = await run(row("d"), async () => job("succeeded", { result: { outputAssetId: null, renderer: null, modelId: null, label: null } }));
  check("succeeded without asset id -> failed", u[0]?.status === "failed");

  u = await run(row("e"), async () => job("failed", { error: { code: "x", message: "Renderer ran out of memory.", retryable: false } }));
  check("failed -> failed with job error message", u[0]?.status === "failed" && u[0].errorMessage === "Renderer ran out of memory.");

  u = await run(row("f"), async () => job("cancelled"));
  check("cancelled -> failed", u[0]?.status === "failed");

  u = await run(row("g"), async () => job("running"));
  check("running -> untouched", u.length === 0);
  u = await run(row("h"), async () => job("queued"));
  check("queued -> untouched", u.length === 0);

  u = await run(row("i"), async () => { throw new TypeError("fetch failed"); });
  check("rooms unreachable -> row left alone", u.length === 0);

  u = await run(row("j", new Date(NOW - 46 * 60 * 1000)), async () => { throw new TypeError("fetch failed"); });
  check("unreachable past max age -> failed Render timed out", u[0]?.status === "failed" && u[0].errorMessage === "Render timed out");

  const terminal = { ...row("k"), status: "completed" } as Render;
  u = await run(terminal, async () => ok());
  check("terminal rows are not re-processed", u.length === 0);

  // crash safety: one row throws on update, the next is still processed
  const updated: string[] = [];
  await reconcileOnce({
    storage: {
      getGeneratingAiRenders: async () => [row("l"), row("m")],
      updateRender: async (id) => { if (id === "l") throw new Error("db down"); updated.push(id); return row(id); },
    },
    getJob: async () => ok(), fetchAsset: async () => ({ found: true, bytes: PNG, contentType: "image/png" }), now: () => NOW, log: () => {},
  });
  check("one row throwing does not stop the loop", updated.join() === "m");

  console.log(failures === 0 ? "ALL RECONCILER TESTS PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
