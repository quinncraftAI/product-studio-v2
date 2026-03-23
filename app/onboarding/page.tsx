"use client";

import { useRef, useState } from "react";
import Image from "next/image";

type CreateStatus = {
  brandId?: string;
  productId?: string;
  campaignId?: string;
  error?: string;
};

const INPUT_CLS =
  "rounded-md border border-[#27272a] bg-[#0a0a0a] px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600";

export default function OnboardingPage() {
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [productName, setProductName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImagePreview, setProductImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CreateStatus>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = (file: File | null) => {
    setProductImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setProductImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setProductImagePreview(null);
    }
  };

  const runOnboarding = async () => {
    setLoading(true);
    setStatus({});

    try {
      const brandRes = await fetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brandName, slug: brandSlug }),
      });
      const brandJson = await brandRes.json();
      if (!brandRes.ok) throw new Error(brandJson.error || "Brand create failed");

      // Upload product image if provided
      let imageUrl: string | undefined;
      if (productImageFile) {
        const fd = new FormData();
        fd.append("file", productImageFile);
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        const uploadJson = await uploadRes.json();
        if (uploadRes.ok) imageUrl = uploadJson.url;
      }

      const productRes = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brandJson.data.id, name: productName, imageUrl }),
      });
      const productJson = await productRes.json();
      if (!productRes.ok) throw new Error(productJson.error || "Product create failed");

      const campaignRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brandJson.data.id,
          productId: productJson.data.id,
          name: campaignName,
        }),
      });
      const campaignJson = await campaignRes.json();
      if (!campaignRes.ok) throw new Error(campaignJson.error || "Campaign create failed");

      setStatus({
        brandId: brandJson.data.id,
        productId: productJson.data.id,
        campaignId: campaignJson.data.id,
      });
    } catch (error) {
      setStatus({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Setup</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create a Brand, Product, and Campaign to get started.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[#27272a] bg-[#09090b] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Brand</p>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Brand name
          <input
            className={INPUT_CLS}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Naturals"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Brand slug
          <input
            className={INPUT_CLS}
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            placeholder="acme-naturals"
          />
        </label>

        <div className="my-1 h-px bg-[#27272a]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Product</p>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Product name
          <input
            className={INPUT_CLS}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Vitamin C Face Serum"
          />
        </label>

        {/* Product image upload */}
        <div className="flex flex-col gap-1 text-xs text-zinc-500">
          Product image (optional)
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file?.type.startsWith("image/")) handleImageFile(file);
            }}
            onDragOver={(e) => e.preventDefault()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[#27272a] bg-[#0a0a0a] p-4 text-center transition-colors hover:border-zinc-600"
          >
            {productImagePreview ? (
              <div className="relative h-28 w-full overflow-hidden rounded">
                <Image src={productImagePreview} alt="Product" fill className="object-contain" unoptimized />
                <button
                  onClick={(e) => { e.stopPropagation(); handleImageFile(null); }}
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
                <span className="text-zinc-600">Drop or click to upload product image</span>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageFile(e.target.files?.[0] || null)}
            />
          </div>
        </div>

        <div className="my-1 h-px bg-[#27272a]" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Campaign</p>

        <label className="flex flex-col gap-1 text-xs text-zinc-500">
          Campaign name
          <input
            className={INPUT_CLS}
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="April Launch Campaign"
          />
        </label>

        <button
          className="mt-1 rounded-md bg-white px-4 py-2 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-30"
          onClick={runOnboarding}
          disabled={loading}
        >
          {loading ? "Creating…" : "Create records"}
        </button>
      </div>

      {status.error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-400">
          {status.error}
        </div>
      )}

      {status.brandId && (
        <div className="rounded-md border border-emerald-900 bg-emerald-950/50 px-3 py-2 font-mono text-xs text-emerald-400">
          <p>Brand: {status.brandId}</p>
          <p>Product: {status.productId}</p>
          <p>Campaign: {status.campaignId}</p>
        </div>
      )}
    </main>
  );
}
