"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import Image from "next/image";

type OutputItem = {
  id: string;
  filePath: string;
  thumbPath: string | null;
  width?: number | null;
  height?: number | null;
  mode: string;
  jobId: string;
  createdAt: string;
};

type ProductItem = {
  id: string;
  name: string;
  sku: string | null;
  outputs: OutputItem[];
};

type BrandItem = {
  id: string;
  name: string;
  slug: string;
  products: ProductItem[];
};

export default function LibraryPage() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/library")
      .then((r) => r.json())
      .then((json) => {
        setBrands(json.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function toggleOutput(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const all = brands.flatMap((b) => b.products.flatMap((p) => p.outputs.map((o) => o.id)));
    setSelected(new Set(all));
  }

  function clearAll() {
    setSelected(new Set());
  }

  async function exportZip() {
    // Gather selected outputs with their brand/product context
    const toExport: Array<{ brandSlug: string; sku: string; mode: string; id: string; filePath: string }> = [];

    for (const brand of brands) {
      for (const product of brand.products) {
        const sku = product.sku ?? product.id;
        for (const output of product.outputs) {
          if (selected.has(output.id)) {
            toExport.push({
              brandSlug: brand.slug,
              sku,
              mode: output.mode,
              id: output.id,
              filePath: output.filePath,
            });
          }
        }
      }
    }

    if (toExport.length === 0) return;

    setExporting(true);
    try {
      const zip = new JSZip();

      await Promise.all(
        toExport.map(async ({ brandSlug, sku, mode, id, filePath }) => {
          const res = await fetch(filePath);
          if (!res.ok) return;
          const blob = await res.blob();
          const path = `${brandSlug}/${sku}/${mode}-${id}.png`;
          zip.file(path, blob);
        }),
      );

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "library-export.zip");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-sm text-zinc-500">Loading library…</p>
      </main>
    );
  }

  const totalOutputs = brands.flatMap((b) => b.products.flatMap((p) => p.outputs)).length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link href="/" className="text-xs text-zinc-400 hover:text-zinc-600">
            ← Home
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-zinc-500">
            {totalOutputs} approved asset{totalOutputs !== 1 ? "s" : ""} across {brands.length} brand
            {brands.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
          >
            Select all
          </button>
          {selected.size > 0 && (
            <>
              <button
                onClick={clearAll}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50"
              >
                Clear ({selected.size})
              </button>
              <button
                onClick={exportZip}
                disabled={exporting}
                className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {exporting ? "Exporting…" : `Export ZIP (${selected.size})`}
              </button>
            </>
          )}
        </div>
      </div>

      {brands.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 px-8 py-16 text-center">
          <p className="text-sm text-zinc-500">No approved outputs yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Go to the{" "}
            <Link href="/studio" className="underline">
              Generation Studio
            </Link>{" "}
            and approve some assets.
          </p>
        </div>
      ) : (
        <div className="space-y-12">
          {brands.map((brand) => (
            <section key={brand.id}>
              <h2 className="mb-4 text-lg font-semibold">{brand.name}</h2>
              <div className="space-y-8">
                {brand.products.map((product) => (
                  <div key={product.id}>
                    <h3 className="mb-3 text-sm font-medium text-zinc-600">
                      {product.name}
                      {product.sku && (
                        <span className="ml-2 font-mono text-xs text-zinc-400">SKU: {product.sku}</span>
                      )}
                    </h3>
                    <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5">
                      {product.outputs.map((output) => {
                        const isSelected = selected.has(output.id);
                        return (
                          <button
                            key={output.id}
                            onClick={() => toggleOutput(output.id)}
                            className={`group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-black ring-2 ring-black ring-offset-2"
                                : "border-transparent hover:border-zinc-300 hover:shadow-md"
                            }`}
                          >
                            <Image
                              src={output.thumbPath ?? output.filePath}
                              alt={`${output.mode} output`}
                              width={output.width || 1024}
                              height={output.height || 1024}
                              className="h-auto w-full object-cover block"
                              unoptimized
                            />
                            <div
                              className={`absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-1.5 transition-opacity ${
                                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                              }`}
                            >
                              <span className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-800">
                                {output.mode.replace(/_/g, " ")}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black text-white">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path
                                    d="M2 5l2.5 2.5L8 3"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
