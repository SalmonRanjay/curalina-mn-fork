/**
 * Render reconciler (dispatch item 22, ADR-0018 §D6).
 *
 * Background poller in the app: for each `renders` row in `generating` with
 * an `aiServiceRef.jobId`, reads rooms `GET /v1/jobs/{id}` and maps the job's
 * terminal state onto the render row WITHOUT collapsing job success into
 * render success (ADR-0016): `completed` is written only after the output
 * asset's PNG bytes have actually been fetched and verified. Not a webhook,
 * and not inline in `GET /api/render/:id`.
 */

import type { InsertRender, Render } from "@shared/schema";
import {
  fetchRoomAssetContent,
  getRoomJobStatus,
  isPngBytes,
  type RoomAssetContent,
  type RoomJobStatus,
} from "./render-job-client.js";

export interface ReconcilerStorage {
  getGeneratingAiRenders(): Promise<Render[]>;
  updateRender(id: string, data: Partial<InsertRender>): Promise<Render>;
}

export interface ReconcilerDeps {
  storage: ReconcilerStorage;
  getJob?: (jobId: string) => Promise<RoomJobStatus>;
  fetchAsset?: (assetId: string) => Promise<RoomAssetContent>;
  now?: () => number;
  maxAgeMs?: number;
  log?: (msg: string, meta?: Record<string, unknown>) => void;
}

const DEFAULT_MAX_AGE_MS = 45 * 60 * 1000;

type Ref = Record<string, unknown> & { jobId?: string };

/** Processes one row. Never throws for per-row outcomes; may throw on
 * storage errors (caught by the caller). */
async function reconcileRow(render: Render, deps: Required<Omit<ReconcilerDeps, "storage">> & { storage: ReconcilerStorage }): Promise<void> {
  const ref = (render.aiServiceRef ?? {}) as Ref;
  const jobId = typeof ref.jobId === "string" ? ref.jobId : null;
  if (!jobId || render.status !== "generating") return;

  const fail = (reason: string) =>
    deps.storage.updateRender(render.id, { status: "failed", errorMessage: reason } as Partial<InsertRender>);

  const createdAt = render.createdAt ? new Date(render.createdAt).getTime() : deps.now();
  const tooOld = deps.now() - createdAt > deps.maxAgeMs;

  let job: RoomJobStatus;
  try {
    job = await deps.getJob(jobId);
  } catch (err) {
    // Transient outage (or unknown job): leave the row, but give up eventually.
    deps.log("reconciler: rooms job lookup failed", { renderId: render.id, jobId, error: String(err) });
    if (tooOld) await fail("Render timed out");
    return;
  }

  switch (job.status) {
    case "queued":
    case "running":
      if (tooOld) await fail("Render timed out");
      return;
    case "cancelled":
      await fail("The render was cancelled.");
      return;
    case "failed":
      await fail(job.error?.message || "The render could not be produced.");
      return;
    case "succeeded": {
      const assetId = job.result?.outputAssetId;
      if (!assetId) {
        await fail("The render finished but produced no image.");
        return;
      }
      let content: RoomAssetContent;
      try {
        content = await deps.fetchAsset(assetId);
      } catch (err) {
        deps.log("reconciler: asset fetch failed", { renderId: render.id, assetId, error: String(err) });
        if (tooOld) await fail("Render timed out");
        return;
      }
      if (!content.found || !isPngBytes(content.bytes)) {
        await fail("The render finished but its image could not be retrieved.");
        return;
      }
      await deps.storage.updateRender(render.id, {
        status: "completed",
        imageUrl: `/api/render/${render.id}/image`,
        errorMessage: null,
        aiServiceRef: {
          ...ref,
          assetId,
          assetIds: [assetId],
          renderer: job.result?.renderer ?? ref.renderer ?? null,
          modelId: job.result?.modelId ?? null,
          label: job.result?.label ?? null,
        },
      } as Partial<InsertRender>);
      return;
    }
    default:
      deps.log("reconciler: unknown job status, leaving row", { renderId: render.id, status: job.status });
  }
}

/** One pass over all generating rows. A failure on one row never stops the rest. */
export async function reconcileOnce(d: ReconcilerDeps): Promise<void> {
  const deps = {
    storage: d.storage,
    getJob: d.getJob ?? getRoomJobStatus,
    fetchAsset: d.fetchAsset ?? fetchRoomAssetContent,
    now: d.now ?? Date.now,
    maxAgeMs: d.maxAgeMs ?? DEFAULT_MAX_AGE_MS,
    log: d.log ?? ((m, meta) => console.warn(m, meta ?? "")),
  };
  let rows: Render[];
  try {
    rows = await deps.storage.getGeneratingAiRenders();
  } catch (err) {
    deps.log("reconciler: could not list generating renders", { error: String(err) });
    return;
  }
  for (const row of rows) {
    try {
      await reconcileRow(row, deps);
    } catch (err) {
      deps.log("reconciler: row failed", { renderId: row.id, error: String(err) });
    }
  }
}

/** Starts the poller. No overlapping ticks; timer is unref'd. Returns stop(). */
export function startRenderReconciler(
  storage: ReconcilerStorage,
  opts: { intervalMs?: number; maxAgeMs?: number } = {}
): () => void {
  const intervalMs = opts.intervalMs ?? (Number(process.env.CURALINA_RECONCILE_INTERVAL_MS) || 3000);
  const maxAgeMs = opts.maxAgeMs ?? (Number(process.env.CURALINA_RECONCILE_MAX_AGE_MS) || DEFAULT_MAX_AGE_MS);
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await reconcileOnce({ storage, maxAgeMs });
    } catch (err) {
      console.warn("reconciler: tick failed", String(err));
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
