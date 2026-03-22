import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId")?.trim();
  const productId = searchParams.get("productId")?.trim();

  const campaigns = await prisma.campaign.findMany({
    where: {
      ...(brandId ? { brandId } : {}),
      ...(productId ? { productId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: campaigns });
}

export async function POST(request: Request) {
  const body = await request.json();

  const brandId = String(body?.brandId ?? "").trim();
  const productId = body?.productId ? String(body.productId).trim() : null;
  const name = String(body?.name ?? "").trim();
  const objective = body?.objective ? String(body.objective).trim() : null;
  const channelsJson = body?.channelsJson ? JSON.stringify(body.channelsJson) : null;

  if (!brandId || !name) {
    return NextResponse.json(
      { error: "brandId and name are required" },
      { status: 400 },
    );
  }

  const campaign = await prisma.campaign.create({
    data: {
      brandId,
      productId,
      name,
      objective,
      channelsJson,
    },
  });

  return NextResponse.json({ data: campaign }, { status: 201 });
}
