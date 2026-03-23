import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { runGenerationPipeline } from "@/lib/generation-pipeline";

type CreateGenerationBody = {
  brandId?: string;
  productId?: string;
  campaignId?: string;
  mode?:
    | "white_bg_ecommerce"
    | "flatlay"
    | "lifestyle_indian"
    | "lifestyle_international"
    | "stylised_product"
    | "social_post"
    | "performance_creative"
    | "custom_prompt";
  promptRaw?: string;
  batchSize?: number;
  params?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId")?.trim();
  const productId = searchParams.get("productId")?.trim();
  const status = searchParams.get("status")?.trim() as
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "partial"
    | null;

  const jobs = await prisma.generationJob.findMany({
    where: {
      ...(brandId ? { brandId } : {}),
      ...(productId ? { productId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: jobs });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateGenerationBody;

  const brandId = String(body.brandId ?? "").trim();
  const productId = String(body.productId ?? "").trim();
  const mode = body.mode;

  if (!brandId || !productId || !mode) {
    return NextResponse.json(
      { error: "brandId, productId and mode are required" },
      { status: 400 },
    );
  }

  try {
    const job = await prisma.generationJob.create({
      data: {
        brandId,
        productId,
        campaignId: body.campaignId ? String(body.campaignId) : null,
        mode,
        promptRaw: body.promptRaw?.trim() || null,
        paramsJson: body.params ? JSON.stringify(body.params) : null,
        batchSize: Number.isFinite(body.batchSize) ? Math.max(1, Number(body.batchSize)) : 4,
        status: "queued",
      },
    });

    // Kick off background generation (local-first mock execution)
    runGenerationPipeline(job.id).catch(console.error);

    return NextResponse.json(
      {
        data: job,
        note: "Generation execution started.",
      },
      { status: 201 },
    );
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: "Foreign key constraint failed. Ensure the selected Brand and Product exist." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
