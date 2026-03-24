import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { FilterBar } from "./FilterBar";
import { HistoryGrid } from "./HistoryGrid";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const modeFilter = typeof sp.mode === "string" ? sp.mode : "";
  const statusFilter = typeof sp.status === "string" ? sp.status : "";
  const sort = typeof sp.sort === "string" ? sp.sort : "desc";

  // Fetch jobs and their outputs based on filters
  const jobs = await prisma.generationJob.findMany({
    where: {
      ...(modeFilter ? { mode: modeFilter as any } : {}),
      ...(statusFilter ? { status: statusFilter as any } : {}),
    },
    orderBy: { createdAt: sort === "asc" ? "asc" : "desc" },
    include: {
      brand: true,
      product: true,
      outputs: true,
    },
    take: 100, // Limit to last 100 jobs for performance
  });

  // Flatten outputs into a single list
  const allOutputs = jobs.flatMap((job) =>
    job.outputs.map((out) => ({
      id: out.id,
      filePath: out.filePath,
      thumbPath: out.thumbPath,
      approvalState: out.approvalState,
      versionNo: out.versionNo,
      createdAt: out.createdAt,
      jobId: job.id,
      mode: job.mode,
      brandName: job.brand?.name || "Unbranded",
      productName: job.product?.name || "Unnamed Product",
    }))
  );

  // Secondary sort for the outputs themselves within the grid
  if (sort === "desc") {
    allOutputs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } else {
    allOutputs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return (
    <main className="min-h-screen w-full bg-zinc-50">
      {/* Header Bar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900">Gallery</h1>
            <p className="text-xs text-zinc-500">
              {allOutputs.length} assets generated
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Suspense fallback={<div className="h-9 w-64 animate-pulse rounded-lg bg-zinc-100" />}>
              <FilterBar mode={modeFilter} status={statusFilter} sort={sort} />
            </Suspense>

            <Link
              href="/studio"
              className="hidden rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-transform hover:scale-105 sm:block"
            >
              + Create
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <section className="mx-auto max-w-[1600px]">
        <HistoryGrid initialOutputs={allOutputs} />
      </section>
    </main>
  );
}
