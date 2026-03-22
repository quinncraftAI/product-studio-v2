"use client";

import { useMemo, useState } from "react";

type GenerationMode = {
  key:
    | "white_bg_ecommerce"
    | "flatlay"
    | "lifestyle_indian"
    | "lifestyle_international"
    | "stylised_product"
    | "social_post"
    | "performance_creative"
    | "custom_prompt";
  title: string;
  hint: string;
  ratios: string[];
};

const MODES: GenerationMode[] = [
  { key: "white_bg_ecommerce", title: "White BG (E-commerce)", hint: "Clean catalog photos", ratios: ["1:1", "4:5"] },
  { key: "flatlay", title: "Flatlay", hint: "Top-down product compositions", ratios: ["1:1", "4:5"] },
  { key: "lifestyle_indian", title: "Lifestyle (Indian)", hint: "Indian context humans + scenes", ratios: ["4:5", "9:16"] },
  { key: "lifestyle_international", title: "Lifestyle (International)", hint: "Global look and context", ratios: ["4:5", "9:16"] },
  { key: "stylised_product", title: "Stylised Product", hint: "Premium stylized visuals", ratios: ["1:1", "16:9"] },
  { key: "social_post", title: "Social Media Post", hint: "Feed-friendly branded creatives", ratios: ["1:1", "4:5", "9:16"] },
  { key: "performance_creative", title: "Performance Creative", hint: "Ad creative candidates", ratios: ["1:1", "4:5", "9:16", "16:9"] },
  { key: "custom_prompt", title: "Custom Prompt", hint: "Free-form + AI enhancer", ratios: ["1:1", "4:5", "9:16", "16:9"] },
];

export default function StudioPage() {
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [mode, setMode] = useState<GenerationMode["key"]>("white_bg_ecommerce");
  const [promptRaw, setPromptRaw] = useState("");
  const [useEnhancer, setUseEnhancer] = useState(true);
  const [batchSize, setBatchSize] = useState(8);
  const [ratio, setRatio] = useState("1:1");
  const [lighting, setLighting] = useState("studio soft");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<string>("");

  const currentMode = useMemo(() => MODES.find((m) => m.key === mode)!, [mode]);

  const submitJob = async () => {
    setIsSubmitting(true);
    setResponse("");

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          productId,
          campaignId: campaignId || undefined,
          mode,
          promptRaw,
          batchSize,
          params: { ratio, lighting, useEnhancer },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to queue generation job");

      setResponse(`Queued job: ${json.data.id}`);
    } catch (error) {
      setResponse(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[320px_1fr_320px]">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Generation Controls</h2>
        <p className="mb-4 text-sm text-zinc-600">Mode, prompt, and batch settings.</p>

        <div className="space-y-3 text-sm">
          <input className="w-full rounded border px-3 py-2" placeholder="Brand ID" value={brandId} onChange={(e) => setBrandId(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Product ID" value={productId} onChange={(e) => setProductId(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Campaign ID (optional)" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} />

          <label className="grid gap-1">
            Mode
            <select className="rounded border px-3 py-2" value={mode} onChange={(e) => setMode(e.target.value as GenerationMode["key"])}>
              {MODES.map((m) => (
                <option key={m.key} value={m.key}>{m.title}</option>
              ))}
            </select>
          </label>

          <textarea className="min-h-28 w-full rounded border px-3 py-2" placeholder="Describe what to generate..." value={promptRaw} onChange={(e) => setPromptRaw(e.target.value)} />

          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useEnhancer} onChange={(e) => setUseEnhancer(e.target.checked)} />
            Use AI prompt enhancer
          </label>

          <label className="grid gap-1">
            Batch size
            <input type="number" min={1} max={100} className="rounded border px-3 py-2" value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} />
          </label>

          <label className="grid gap-1">
            Ratio
            <select className="rounded border px-3 py-2" value={ratio} onChange={(e) => setRatio(e.target.value)}>
              {currentMode.ratios.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            Lighting
            <input className="rounded border px-3 py-2" value={lighting} onChange={(e) => setLighting(e.target.value)} />
          </label>

          <button onClick={submitJob} disabled={isSubmitting} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            {isSubmitting ? "Queueing..." : "Queue Generation Job"}
          </button>

          {response ? <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">{response}</p> : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Output Grid (Day 3 scaffold)</h2>
        <p className="mb-4 text-sm text-zinc-600">This will show generated outputs starting Day 4.</p>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="aspect-square rounded-lg border border-dashed border-zinc-300 bg-zinc-50" />
          ))}
        </div>
      </section>

      <aside className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Mode Presets</h2>
        <div className="mt-3 space-y-2">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`w-full rounded-lg border p-3 text-left ${m.key === mode ? "border-black bg-zinc-100" : "border-zinc-200"}`}
            >
              <p className="text-sm font-medium">{m.title}</p>
              <p className="text-xs text-zinc-600">{m.hint}</p>
            </button>
          ))}
        </div>
      </aside>
    </main>
  );
}
