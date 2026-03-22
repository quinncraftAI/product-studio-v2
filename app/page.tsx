import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center gap-8 px-6">
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
          Product Studio v1
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Day 3 Build in Progress</h1>
        <p className="max-w-2xl text-zinc-600">
          Generation Studio scaffold is live with mode presets, prompt controls, and queue endpoint.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/onboarding" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium">
          Onboarding
        </Link>
        <Link href="/studio" className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white">
          Open Generation Studio
        </Link>
        <Link href="/history" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium">
          Generation History
        </Link>
      </div>
    </main>
  );
}
