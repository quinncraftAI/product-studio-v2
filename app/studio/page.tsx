"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";

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
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [regenOutputId, setRegenOutputId] = useState<string | null>(null);
  const [regenInstruction, setRegenInstruction] = useState("");
  const [isRegenerating, setIsRegenerating] = useState<Record<string, boolean>>({});

  const currentMode = useMemo(() => MODES.find((m) => m.key === mode)!, [mode]);

  // Polling for job updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (currentJob && (currentJob.status === "queued" || currentJob.status === "running")) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/generations/${currentJob.id}`);
          const json = await res.json();
          if (res.ok && json.data) {
            setCurrentJob(json.data);
            if (json.data.status === "completed" || json.data.status === "failed") {
              setResponse(`Job ${json.data.status}!`);
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentJob]);

  const handleApproval = async (outputId: string, newState: "approved" | "rejected" | "pending") => {
    // Optimistic update
    setCurrentJob((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        outputs: prev.outputs.map((out: any) => 
          out.id === outputId ? { ...out, approvalState: newState } : out
        ),
      };
    });

    try {
      await fetch(`/api/outputs/${outputId}/${newState}`, { method: "POST" });
    } catch (err) {
      console.error("Approval state update failed", err);
    }
  };

  const handleBulkApprove = () => {
    if (!currentJob?.outputs) return;
    currentJob.outputs.forEach((out: any) => {
      if (out.approvalState !== "approved") {
        handleApproval(out.id, "approved");
      }
    });
  };

  const handleBulkReject = () => {
    if (!currentJob?.outputs) return;
    currentJob.outputs.forEach((out: any) => {
      if (out.approvalState !== "rejected") {
        handleApproval(out.id, "rejected");
      }
    });
  };

  const submitRegenerate = async (outputId: string) => {
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
      
      // Add the new child output to the local state so UI updates
      setCurrentJob((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          outputs: [json.data, ...prev.outputs], // prepend to show up as newest
        };
      });
      
    } catch (err) {
      console.error("Regeneration failed", err);
    } finally {
      setIsRegenerating((prev) => ({ ...prev, [outputId]: false }));
      setRegenInstruction("");
    }
  };

  const submitJob = async () => {
    setIsSubmitting(true);
    setResponse("");
    setCurrentJob(null);

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

      setResponse(`Started job: ${json.data.id}`);
      setCurrentJob(json.data);
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Review Board (Day 5)</h2>
            <p className="text-sm text-zinc-600">
              {currentJob
                ? `Status: ${currentJob.status} | Outputs: ${currentJob.outputs?.length || 0}/${currentJob.batchSize}`
                : "Submit a job to see generation progress."}
            </p>
          </div>
          
          {currentJob && currentJob.status === "completed" && (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleBulkApprove}
                className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Approve All
              </button>
              <button 
                onClick={handleBulkReject}
                className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Reject All
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {currentJob && currentJob.outputs && currentJob.outputs.length > 0 ? (
            (() => {
              // Group outputs by parent to only show leaf nodes
              const parentIds = new Set(currentJob.outputs.map((o: any) => o.parentOutputId).filter(Boolean));
              const leafOutputs = currentJob.outputs.filter((o: any) => !parentIds.has(o.id));
              
              return leafOutputs.map((out: any) => (
                <div 
                  key={out.id} 
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-zinc-100 group transition-all
                    ${out.approvalState === "approved" ? "border-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]" : 
                      out.approvalState === "rejected" ? "border-red-500 opacity-50 grayscale" : "border-zinc-200"}`
                  }
                >
                  <Image src={out.filePath} alt={`Generated output v${out.versionNo}`} fill className="object-cover" />
                  
                  {/* Hover Overlay */}
                  <div className={`absolute inset-0 flex flex-col justify-between p-2 transition-all z-10
                    ${out.approvalState === "pending" && regenOutputId !== out.id ? "bg-black/0 group-hover:bg-black/40 opacity-0 group-hover:opacity-100" : "bg-black/10 opacity-100"}`}
                  >
                    {/* Top Right Controls (Approve/Reject) */}
                    <div className="flex justify-end gap-1.5">
                      {regenOutputId !== out.id && !isRegenerating[out.id] && (
                        <>
                          <button 
                            onClick={() => handleApproval(out.id, out.approvalState === "approved" ? "pending" : "approved")}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-white backdrop-blur-md transition-colors
                              ${out.approvalState === "approved" ? "bg-emerald-500" : "bg-black/50 hover:bg-emerald-500"}`}
                            title={out.approvalState === "approved" ? "Undo Approval" : "Approve"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                          </button>
                          <button 
                            onClick={() => handleApproval(out.id, out.approvalState === "rejected" ? "pending" : "rejected")}
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-white backdrop-blur-md transition-colors
                              ${out.approvalState === "rejected" ? "bg-red-500" : "bg-black/50 hover:bg-red-500"}`}
                            title={out.approvalState === "rejected" ? "Undo Rejection" : "Reject"}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Bottom Status / Regeneration UI */}
                    <div className="flex flex-col gap-2">
                      {isRegenerating[out.id] ? (
                        <div className="flex items-center gap-2 rounded bg-black/70 p-2 backdrop-blur-md">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                          <span className="text-xs text-white">Regenerating...</span>
                        </div>
                      ) : regenOutputId === out.id ? (
                        <div className="flex flex-col gap-2 rounded bg-black/70 p-2 backdrop-blur-md" onClick={(e) => e.stopPropagation()}>
                          <input 
                            autoFocus
                            placeholder="Instruction (e.g. 'Make it darker')" 
                            className="w-full rounded border-0 bg-white/20 px-2 py-1.5 text-xs text-white placeholder-white/50 focus:outline-none focus:ring-1 focus:ring-white"
                            value={regenInstruction}
                            onChange={(e) => setRegenInstruction(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") submitRegenerate(out.id);
                              if (e.key === "Escape") setRegenOutputId(null);
                            }}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => submitRegenerate(out.id)} className="flex-1 rounded bg-white px-2 py-1 text-[10px] font-bold text-black hover:bg-zinc-200">Go</button>
                            <button onClick={() => setRegenOutputId(null)} className="flex-1 rounded bg-black/50 px-2 py-1 text-[10px] font-bold text-white hover:bg-black/70">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="rounded bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-md">
                            {out.approvalState}
                          </div>
                          {out.versionNo > 1 && (
                            <div className="rounded bg-indigo-500/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-md">
                              v{out.versionNo}
                            </div>
                          )}
                          <button 
                            onClick={() => {
                              setRegenOutputId(out.id);
                              setRegenInstruction("");
                            }}
                            className="ml-auto flex items-center justify-center rounded bg-blue-500/90 px-2 py-1 text-[10px] font-bold text-white hover:bg-blue-400"
                            title="Regenerate with instructions"
                          >
                            Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ));
            })()
          ) : currentJob && (currentJob.status === "queued" || currentJob.status === "running") ? (
            Array.from({ length: currentJob.batchSize || batchSize }).map((_, idx) => (
              <div key={idx} className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
              </div>
            ))
          ) : (
            Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="aspect-square rounded-lg border border-dashed border-zinc-200 bg-zinc-50/50" />
            ))
          )}
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
