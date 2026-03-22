"use client";

import { useState } from "react";

type CreateStatus = {
  brandId?: string;
  productId?: string;
  campaignId?: string;
  error?: string;
};

export default function OnboardingPage() {
  const [brandName, setBrandName] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [productName, setProductName] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CreateStatus>({});

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

      const productRes = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brandJson.data.id, name: productName }),
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
      if (!campaignRes.ok)
        throw new Error(campaignJson.error || "Campaign create failed");

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
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Product Studio Onboarding</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Day 2 scaffold: create Brand → Product → Campaign in one guided flow.
        </p>
      </div>

      <div className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-5">
        <label className="grid gap-1 text-sm">
          Brand name
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="Acme Naturals"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Brand slug
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            placeholder="acme-naturals"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Product name
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Vitamin C Face Serum"
          />
        </label>

        <label className="grid gap-1 text-sm">
          Campaign name
          <input
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            placeholder="April Launch Campaign"
          />
        </label>

        <button
          className="mt-2 rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
          onClick={runOnboarding}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create onboarding records"}
        </button>
      </div>

      {status.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {status.error}
        </p>
      ) : null}

      {status.brandId ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <p>Brand: {status.brandId}</p>
          <p>Product: {status.productId}</p>
          <p>Campaign: {status.campaignId}</p>
        </div>
      ) : null}
    </main>
  );
}
