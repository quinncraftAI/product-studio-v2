import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FilterBar } from "./FilterBar";

// ─── constants ───────────────────────────────────────────────────────────────

const MODE_LABELS: Record<string, string> = {
  white_bg_ecommerce: "White BG",
  flatlay: "Flatlay",
  lifestyle_indian: "Lifestyle (IN)",
  lifestyle_international: "Lifestyle (Intl)",
  stylised_product: "Stylised",
  social_post: "Social Post",
  performance_creative: "Performance",
  custom_prompt: "Custom",
};

const STATUS_STYLES: Record<string, string> = {
  queued: "bg-zinc-100 text-zinc-600",
  running: "bg-blue-50 text-blue-600 animate-pulse",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
  partial: "bg-amber-50 text-amber-700",
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// ─── types ───────────────────────────────────────────────────────────────────

type Output = {
  id: string;
  filePath: string;
  thumbPath: string | null;
  approvalState: string;
  versionNo: number;
  parentOutputId: string | null;
};

type Job = {
  id: string;
  mode: string;
  status: string;
  promptRaw: string | null;
  promptEnhanced: string | null;
  batchSize: number;
  createdAt: Date;
  completedAt: Date | null;
  brand: { id: string; name: string };
  product: { id: string; name: string };
  outputs: Output[];
};

// ─── sub-components ──────────────────────────────────────────────────────────

function ApprovalSummary({ outputs }: { outputs: Output[] }) {
  const approved = outputs.filter((o) => o.approvalState === "approved").length;
  const rejected = outputs.filter((o) => o.approvalState === "rejected").length;
  const pending = outputs.filter((o) => o.approvalState === "pending").length;

  if (outputs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {approved > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          {approved} approved
        </span>
      )}
      {rejected > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-600">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          {rejected} rejected
        </span>
      )}
      {pending > 0 && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-500">
          {pending} pending
        </span>
      )}
    </div>
  );
}

function ThumbnailGrid({ outputs }: { outputs: Output[] }) {
  // Show only leaf outputs (not superseded by regeneration)
  const parentIds = new Set(outputs.map((o) => o.parentOutputId).filter(Boolean));
  const leafOutputs = outputs.filter((o) => !parentIds.has(o.id));
  const visible = leafOutputs.slice(0, 8);
  const overflow = leafOutputs.length - visible.length;

  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
      {visible.map((out) => (
        <div
          key={out.id}
          className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-zinc-100
            ${out.approvalState === "approved" ? "border-emerald-400" :
              out.approvalState === "rejected" ? "border-red-300 opacity-50 grayscale" :
              "border-zinc-200"}`}
        >
          <Image
            src={out.thumbPath ?? out.filePath}
            alt={`Output v${out.versionNo}`}
            fill
            className="object-cover"
            sizes="80px"
          />
          {out.versionNo > 1 && (
            <div className="absolute bottom-0.5 right-0.5 rounded bg-indigo-500/80 px-1 py-0.5 text-[8px] font-bold text-white leading-none">
              v{out.versionNo}
            </div>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex aspect-square items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-500">
          +{overflow}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: Job }) {
  const prompt = job.promptEnhanced || job.promptRaw;

  return (
    <article className="relative pl-8">
      {/* Timeline dot */}
      <div className="absolute left-0 top-3 h-3 w-3 rounded-full border-2 border-zinc-300 bg-white" />

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
              {job.brand.name}
            </span>
            <span className="text-xs text-zinc-400">›</span>
            <span className="text-xs text-zinc-600">{job.product.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[job.status] ?? "bg-zinc-100 text-zinc-600"}`}
            >
              {job.status}
            </span>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
              {MODE_LABELS[job.mode] ?? job.mode}
            </span>
          </div>
        </div>

        {/* Prompt summary */}
        {prompt && (
          <p className="mt-2 line-clamp-2 text-sm text-zinc-700">{prompt}</p>
        )}

        {/* Thumbnails */}
        {job.outputs.length > 0 && (
          <div className="mt-3">
            <ThumbnailGrid outputs={job.outputs} />
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <ApprovalSummary outputs={job.outputs} />
          <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
            <span>Batch {job.outputs.length}/{job.batchSize}</span>
            <time
              dateTime={job.createdAt.toISOString()}
              title={formatDate(job.createdAt)}
            >
              {relativeTime(job.createdAt)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20 text-center">
      <div className="mb-3 text-3xl">🎞</div>
      <p className="text-sm font-medium text-zinc-700">No jobs found</p>
      <p className="mt-1 text-xs text-zinc-500">
        Try clearing your filters or{" "}
        <Link href="/studio" className="text-black underline underline-offset-2">
          generate something new
        </Link>
        .
      </p>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const modeFilter = typeof sp.mode === "string" ? sp.mode : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";

  const jobs = (await prisma.generationJob.findMany({
    where: {
      ...(modeFilter ? { mode: modeFilter as never } : {}),
      ...(statusFilter ? { status: statusFilter as never } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      brand: true,
      product: true,
      outputs: { orderBy: { createdAt: "desc" } },
    },
  })) as Job[];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Generation History</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            {modeFilter || statusFilter ? " matching filters" : " total"}
          </p>
        </div>
        <Link
          href="/studio"
          className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          New Generation
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <Suspense fallback={<div className="h-10 animate-pulse rounded-lg bg-zinc-100" />}>
          <FilterBar mode={modeFilter} status={statusFilter} />
        </Suspense>
      </div>

      {/* Timeline feed */}
      {jobs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative space-y-4">
          {/* Vertical timeline line */}
          <div className="absolute left-1.5 top-0 bottom-0 w-px bg-zinc-200" aria-hidden="true" />

          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </main>
  );
}
