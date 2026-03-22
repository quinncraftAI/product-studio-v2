import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-6">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Product Studio v1
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Day 2 Build in Progress</h1>
        <p className="max-w-2xl text-zinc-600">
          Foundation is live. Brand/Product/Campaign APIs are wired with Prisma + SQLite.
          Next step is generation studio flows.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/onboarding"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Open onboarding scaffold
        </Link>
        <a
          href="/api/brands"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium"
        >
          Test /api/brands
        </a>
      </div>
    </main>
  );
}
