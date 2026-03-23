"use client";

import { useRouter, useSearchParams } from "next/navigation";

const MODES = [
  { key: "white_bg_ecommerce", title: "White BG (E-commerce)" },
  { key: "flatlay", title: "Flatlay" },
  { key: "lifestyle_indian", title: "Lifestyle (Indian)" },
  { key: "lifestyle_international", title: "Lifestyle (International)" },
  { key: "stylised_product", title: "Stylised Product" },
  { key: "social_post", title: "Social Media Post" },
  { key: "performance_creative", title: "Performance Creative" },
  { key: "custom_prompt", title: "Custom Prompt" },
];

const STATUSES = [
  { key: "queued", label: "Queued" },
  { key: "running", label: "Running" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
  { key: "partial", label: "Partial" },
];

export function FilterBar({
  mode,
  status,
}: {
  mode: string;
  status: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/history?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/10"
        value={mode}
        onChange={(e) => update("mode", e.target.value)}
      >
        <option value="">All Modes</option>
        {MODES.map((m) => (
          <option key={m.key} value={m.key}>
            {m.title}
          </option>
        ))}
      </select>

      <select
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/10"
        value={status}
        onChange={(e) => update("status", e.target.value)}
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>

      {(mode || status) && (
        <button
          onClick={() => router.push("/history")}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
