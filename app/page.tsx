"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

type Brand = { id: string; name: string; slug: string };
type Product = { id: string; name: string; sku: string | null };
type JobOutput = {
  id: string;
  filePath: string;
  approvalState: string;
  versionNo: number;
  parentOutputId: string | null;
};
type Job = { id: string; status: string; batchSize: number; outputs: JobOutput[] };
type BentoItem = { id: string; filePath: string; mode: string; brandName: string; productName: string };

const MODES = [
  { key: "white_bg_ecommerce", label: "White BG (E-commerce)" },
  { key: "flatlay", label: "Flatlay" },
  { key: "lifestyle_indian", label: "Lifestyle (Indian)" },
  { key: "lifestyle_international", label: "Lifestyle (International)" },
  { key: "stylised_product", label: "Stylised Product" },
  { key: "social_post", label: "Social Post" },
  { key: "performance_creative", label: "Performance Creative" },
  { key: "custom_prompt", label: "Custom Prompt" },
];

const RATIOS = ["1:1", "4:5", "9:16", "16:9"];
const LIGHTING_OPTS = ["studio soft", "golden hour", "overcast", "neon ambient", "high-key white"];

const SELECT_CLS =
  "rounded-md border border-[#27272a] bg-[#0a0a0a] px-2 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600 disabled:opacity-40";

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function StudioPage() {
  // Controls
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [brandId, setBrandId] = useState("");
  const [productId, setProductId] = useState("");
  const [mode, setMode] = useState("white_bg_ecommerce");
  const [ratio, setRatio] = useState("1:1");
  const [lighting, setLighting] = useState("studio soft");
  const [batchSize, setBatchSize] = useState(4);
  const [promptRaw, setPromptRaw] = useState("");
  const [useEnhancer, setUseEnhancer] = useState(true);

  // Reference image
  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Job state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [jobStatus, setJobStatus] = useState("");

  // Bento grid
  const [bentoItems, setBentoItems] = useState<BentoItem[]>([]);

  // Regen
  const [regenOutputId, setRegenOutputId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [isRegenerating, setIsRegenerating] = useState<Record<string, boolean>>({});

  const loadBento = useCallback(async () => {
    const res = await fetch("/api/library");
    const json = await res.json();
    const items: BentoItem[] = [];
    (json.data || []).forEach((brand: any) => {
      brand.products.forEach((product: any) => {
        product.outputs.forEach((output: any) => {
          items.push({
            id: output.id,
            filePath: output.filePath,
            mode: output.mode,
            brandName: brand.name,
            productName: product.name,
          });
        });
      });
    });
    setBentoItems(items);
  }, []);

  // Initial data load
  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((j) => setBrands(j.data || []));
    loadBento();
  }, [loadBento]);

  // Load products when brand changes
  useEffect(() => {
    if (!brandId) {
      setProducts([]);
      setProductId("");
      return;
    }
    fetch(`/api/products?brandId=${brandId}`)
      .then((r) => r.json())
      .then((j) => {
        setProducts(j.data || []);
        setProductId("");
      });
  }, [brandId]);

  // Poll current job
  useEffect(() => {
    if (!currentJob || (currentJob.status !== "queued" && currentJob.status !== "running")) return;
    const interval = setInterval(async () => {
      const res = await fetch(`/api/generations/${currentJob.id}`);
      const json = await res.json();
      if (res.ok && json.data) {
        setCurrentJob(json.data);
        if (json.data.status === "completed") {
          setJobStatus("Complete");
          loadBento();
        } else if (json.data.status === "failed") {
          setJobStatus("Failed");
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [currentJob, loadBento]);

  const handleFileChange = (file: File | null) => {
    setRefImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setRefImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setRefImagePreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) handleFileChange(file);
  };

  const submitJob = async () => {
    if (!brandId || !productId) {
      setJobStatus("Select brand and product first");
      return;
    }
    setIsSubmitting(true);
    setJobStatus("Starting…");
    setCurrentJob(null);

    let referenceImageUrl: string | undefined;
    if (refImageFile) {
      setJobStatus("Uploading reference…");
      const fd = new FormData();
      fd.append("file", refImageFile);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json();
      if (uploadRes.ok) referenceImageUrl = uploadJson.url;
    }

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId,
          productId,
          mode,
          promptRaw,
          batchSize,
          referenceImageUrl,
          params: { ratio, lighting, useEnhancer },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to queue job");
      setJobStatus("Queued");
      setCurrentJob({ ...json.data, outputs: [] });
    } catch (err) {
      setJobStatus(err instanceof Error ? err.message : "Error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproval = async (outputId: string, state: "approved" | "rejected" | "pending") => {
    setCurrentJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        outputs: prev.outputs.map((o) => (o.id === outputId ? { ...o, approvalState: state } : o)),
      };
    });
    await fetch(`/api/outputs/${outputId}/${state}`, { method: "POST" });
  };

  const submitRegen = async (outputId: string) => {
    if (!regenInstruction.trim()) return;
    setIsRegenerating((prev) => ({ ...prev, [outputId]: true }));
    setRegenOutputId(null);
    try {
      const res = await fetch(`/api/outputs/${outputId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructionText: regenInstruction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCurrentJob((prev) => (prev ? { ...prev, outputs: [json.data, ...prev.outputs] } : prev));
    } catch (err) {
      console.error("Regen failed:", err);
    } finally {
      setIsRegenerating((prev) => ({ ...prev, [outputId]: false }));
      setRegenInstruction("");
    }
  };

  const leafOutputs = currentJob
    ? (() => {
        const parentIds = new Set(currentJob.outputs.map((o) => o.parentOutputId).filter(Boolean));
        return currentJob.outputs.filter((o) => !parentIds.has(o.id));
      })()
    : [];

  const isPolling = currentJob?.status === "queued" || currentJob?.status === "running";

  // Bento size pattern (4-col grid, auto rows 160px)
  const bentoClass = (i: number) => {
    if (i % 7 === 0) return "col-span-2 row-span-2";
    if (i % 7 === 4) return "row-span-2";
    return "";
  };

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── Left Sidebar ── */}
      <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#27272a] bg-[#09090b] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          Generation Controls
        </p>

        {/* Brand */}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Brand
          <select className={SELECT_CLS} value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— select brand —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>

        {/* Product */}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Product
          <select
            className={SELECT_CLS}
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={!brandId}
          >
            <option value="">— select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.sku ? ` (${p.sku})` : ""}
              </option>
            ))}
          </select>
        </label>

        {/* Reference Image Dropzone */}
        <div className="flex flex-col gap-1 text-xs text-zinc-500">
          Reference Image
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed bg-[#0a0a0a] p-3 text-center transition-colors ${
              isDragOver ? "border-zinc-500" : "border-[#27272a] hover:border-zinc-600"
            }`}
          >
            {refImagePreview ? (
              <div className="relative h-24 w-full overflow-hidden rounded">
                <Image src={refImagePreview} alt="Reference" fill className="object-contain" unoptimized />
                <button
                  onClick={(e) => { e.stopPropagation(); handleFileChange(null); }}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/80 text-xs text-white hover:bg-zinc-700"
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <svg className="mb-1.5 h-6 w-6 text-zinc-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5V19a2 2 0 002 2h14a2 2 0 002-2v-2.5M16 12l-4-4-4 4M12 8v8" />
                </svg>
                <span className="text-zinc-600">Drop or click to upload</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        {/* Mode */}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Mode
          <select className={SELECT_CLS} value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>
        </label>

        {/* Ratio + Batch */}
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Ratio
            <select className={SELECT_CLS} value={ratio} onChange={(e) => setRatio(e.target.value)}>
              {RATIOS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-500">
            Batch
            <input
              type="number"
              min={1}
              max={16}
              className={SELECT_CLS}
              value={batchSize}
              onChange={(e) => setBatchSize(Math.max(1, Math.min(16, Number(e.target.value))))}
            />
          </label>
        </div>

        {/* Lighting */}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Lighting
          <select className={SELECT_CLS} value={lighting} onChange={(e) => setLighting(e.target.value)}>
            {LIGHTING_OPTS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>

        {/* Prompt */}
        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Prompt
          <textarea
            className="min-h-[80px] w-full resize-none rounded-md border border-[#27272a] bg-[#0a0a0a] px-2 py-1.5 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            placeholder="Describe the scene…"
            value={promptRaw}
            onChange={(e) => setPromptRaw(e.target.value)}
          />
        </label>

        {/* AI Enhancer toggle */}
        <label className="flex cursor-pointer select-none items-center gap-2.5 text-xs text-zinc-500">
          <button
            type="button"
            onClick={() => setUseEnhancer(!useEnhancer)}
            className={`relative h-4 w-7 rounded-full transition-colors ${useEnhancer ? "bg-white" : "bg-zinc-800"}`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-black transition-transform ${useEnhancer ? "translate-x-3.5" : "translate-x-0.5"}`}
            />
          </button>
          AI Enhancer
        </label>

        {/* Generate */}
        <button
          onClick={submitJob}
          disabled={isSubmitting || !brandId || !productId}
          className="mt-1 w-full rounded-md bg-white px-4 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-25"
        >
          {isSubmitting ? "Starting…" : "Generate"}
        </button>

        {/* Status */}
        {jobStatus && (
          <div
            className={`rounded-md border border-[#27272a] px-3 py-2 font-mono text-[10px] ${
              isPolling
                ? "text-yellow-400"
                : currentJob?.status === "failed"
                ? "text-red-400"
                : "text-emerald-400"
            }`}
          >
            {isPolling
              ? `⟳ ${currentJob?.status} · ${currentJob?.outputs?.length ?? 0}/${currentJob?.batchSize ?? batchSize}`
              : jobStatus}
          </div>
        )}
      </aside>

      {/* ── Main Area ── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-black">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#27272a] px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Studio</h1>
            <p className="text-[11px] text-zinc-600">
              {currentJob
                ? `Job ${currentJob.id.slice(-8)} · ${currentJob.status}`
                : "Select controls and generate"}
            </p>
          </div>
          {currentJob?.status === "completed" && leafOutputs.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() =>
                  leafOutputs.forEach((o) => {
                    if (o.approvalState !== "approved") handleApproval(o.id, "approved");
                  })
                }
                className="rounded-md border border-emerald-900 bg-emerald-950 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-900"
              >
                Approve All
              </button>
              <button
                onClick={() =>
                  leafOutputs.forEach((o) => {
                    if (o.approvalState !== "rejected") handleApproval(o.id, "rejected");
                  })
                }
                className="rounded-md border border-red-900 bg-red-950 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-900"
              >
                Reject All
              </button>
            </div>
          )}
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Current job outputs */}
          {currentJob && (
            <div className="mb-8">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {isPolling
                  ? `Generating… (${currentJob.outputs?.length ?? 0}/${currentJob.batchSize})`
                  : `Current Job · ${leafOutputs.length} output${leafOutputs.length !== 1 ? "s" : ""}`}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {isPolling && leafOutputs.length === 0
                  ? Array.from({ length: currentJob.batchSize }).map((_, i) => (
                      <div
                        key={i}
                        className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[#27272a] bg-[#09090b]"
                      >
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
                      </div>
                    ))
                  : leafOutputs.map((out) => (
                      <div
                        key={out.id}
                        className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                          out.approvalState === "approved"
                            ? "border-emerald-500"
                            : out.approvalState === "rejected"
                            ? "border-red-900 opacity-50 grayscale"
                            : "border-[#27272a]"
                        }`}
                      >
                        <Image src={out.filePath} alt="" fill className="object-cover" unoptimized />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 z-10 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/50 group-hover:opacity-100">
                          {/* Top: approve/reject */}
                          <div className="flex justify-end gap-1">
                            {regenOutputId !== out.id && !isRegenerating[out.id] && (
                              <>
                                <button
                                  onClick={() =>
                                    handleApproval(out.id, out.approvalState === "approved" ? "pending" : "approved")
                                  }
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-white backdrop-blur-md transition-colors ${
                                    out.approvalState === "approved"
                                      ? "bg-emerald-500"
                                      : "bg-black/60 hover:bg-emerald-500"
                                  }`}
                                >
                                  <CheckIcon />
                                </button>
                                <button
                                  onClick={() =>
                                    handleApproval(out.id, out.approvalState === "rejected" ? "pending" : "rejected")
                                  }
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-white backdrop-blur-md transition-colors ${
                                    out.approvalState === "rejected"
                                      ? "bg-red-500"
                                      : "bg-black/60 hover:bg-red-500"
                                  }`}
                                >
                                  <XIcon />
                                </button>
                              </>
                            )}
                          </div>
                          {/* Bottom: status / regen */}
                          <div className="flex flex-col gap-1.5">
                            {isRegenerating[out.id] ? (
                              <div className="flex items-center gap-2 rounded bg-black/70 p-2 backdrop-blur-md">
                                <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white" />
                                <span className="text-[10px] text-white">Regenerating…</span>
                              </div>
                            ) : regenOutputId === out.id ? (
                              <div
                                className="flex flex-col gap-1.5 rounded bg-black/80 p-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  autoFocus
                                  placeholder="Instruction…"
                                  className="rounded border-0 bg-white/10 px-2 py-1 text-[10px] text-white placeholder-white/40 focus:outline-none"
                                  value={regenInstruction}
                                  onChange={(e) => setRegenInstruction(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") submitRegen(out.id);
                                    if (e.key === "Escape") setRegenOutputId(null);
                                  }}
                                />
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => submitRegen(out.id)}
                                    className="flex-1 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-black"
                                  >
                                    Go
                                  </button>
                                  <button
                                    onClick={() => setRegenOutputId(null)}
                                    className="flex-1 rounded bg-white/10 px-2 py-0.5 text-[10px] text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white backdrop-blur-md">
                                  {out.approvalState}
                                </span>
                                {out.versionNo > 1 && (
                                  <span className="rounded bg-indigo-600/80 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white backdrop-blur-md">
                                    v{out.versionNo}
                                  </span>
                                )}
                                <button
                                  onClick={() => {
                                    setRegenOutputId(out.id);
                                    setRegenInstruction("");
                                  }}
                                  className="ml-auto rounded bg-blue-600/80 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-blue-500"
                                >
                                  Regen
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
            </div>
          )}

          {/* Historical Bento Grid */}
          {bentoItems.length > 0 && (
            <div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                Approved Library
              </p>
              <div className="grid auto-rows-[160px] grid-cols-4 gap-2">
                {bentoItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`group relative overflow-hidden rounded-lg bg-[#09090b] ${bentoClass(i)}`}
                  >
                    <Image
                      src={item.filePath}
                      alt={item.productName}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      unoptimized
                    />
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <div>
                        <p className="text-[11px] font-semibold text-white">{item.productName}</p>
                        <p className="text-[9px] text-zinc-400">
                          {item.brandName} · {item.mode.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!currentJob && bentoItems.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <div className="grid grid-cols-3 gap-2 opacity-20">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="h-16 w-16 rounded-lg border border-dashed border-zinc-700 bg-[#09090b]" />
                ))}
              </div>
              <p className="text-sm font-medium text-zinc-500">No generations yet</p>
              <p className="text-xs text-zinc-700">Select a brand and product, then hit Generate.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
