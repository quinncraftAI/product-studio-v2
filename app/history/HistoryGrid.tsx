"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { OutputActions } from "./OutputActions";

type OutputExtended = {
  id: string;
  filePath: string;
  thumbPath: string | null;
  approvalState: string;
  versionNo: number;
  createdAt: Date;
  jobId: string;
  mode: string;
  brandName: string;
  productName: string;
};

export function HistoryGrid({ 
  initialOutputs 
}: { 
  initialOutputs: OutputExtended[] 
}) {
  const [selectedImage, setSelectedImage] = useState<OutputExtended | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  if (initialOutputs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20 text-center">
        <div className="mb-3 text-3xl">🎞</div>
        <p className="text-sm font-medium text-zinc-700">No images found</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {initialOutputs.map((out) => (
          <div
            key={out.id}
            className="group relative aspect-square cursor-zoom-in overflow-hidden"
            onClick={() => setSelectedImage(out)}
          >
            <Image
              src={out.thumbPath ?? out.filePath}
              alt={out.productName}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              unoptimized
            />
            
            {/* Hover Info */}
            <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40 p-3 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-[10px] font-medium text-white">{out.brandName}</p>
                <p className="truncate text-xs font-bold text-white">{out.productName}</p>
            </div>

            {/* Quick Actions (only Download/Delete) */}
            <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity group-hover:opacity-100" onClick={e => e.stopPropagation()}>
               <OutputActions outputId={out.id} filePath={out.filePath} />
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 transition-all animate-in fade-in duration-200"
          onClick={() => setSelectedImage(null)}
        >
          <button 
            className="absolute right-6 top-6 z-[110] text-white/70 hover:text-white"
            onClick={() => setSelectedImage(null)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <div className="relative flex max-h-full max-w-5xl flex-col gap-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-square w-full max-w-3xl overflow-hidden rounded-lg shadow-2xl">
                <Image
                    src={selectedImage.filePath}
                    alt={selectedImage.productName}
                    fill
                    className="object-contain"
                    unoptimized
                />
            </div>
            
            <div className="flex items-start justify-between px-2 text-white">
                <div>
                    <h2 className="text-lg font-bold">{selectedImage.productName}</h2>
                    <p className="text-sm text-zinc-400">{selectedImage.brandName} · {selectedImage.mode.replace(/_/g, ' ')}</p>
                </div>
                <div className="flex gap-2">
                    <a 
                        href={selectedImage.filePath} 
                        download 
                        className="flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-black hover:bg-zinc-200"
                    >
                        Download
                    </a>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
