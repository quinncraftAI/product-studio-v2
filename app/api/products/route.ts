import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brandId = searchParams.get("brandId")?.trim();

  const products = await prisma.product.findMany({
    where: brandId ? { brandId } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: products });
}

export async function POST(request: Request) {
  const body = await request.json();

  const brandId = String(body?.brandId ?? "").trim();
  const name = String(body?.name ?? "").trim();
  const sku = body?.sku ? String(body.sku).trim() : null;
  const imageUrl = body?.imageUrl ? String(body.imageUrl).trim() : null;
  const constraintsJson = body?.constraintsJson
    ? JSON.stringify(body.constraintsJson)
    : null;

  if (!brandId || !name) {
    return NextResponse.json(
      { error: "brandId and name are required" },
      { status: 400 },
    );
  }

  const product = await prisma.product.create({
    data: {
      brandId,
      name,
      sku,
      imageUrl,
      constraintsJson,
    },
  });

  return NextResponse.json({ data: product }, { status: 201 });
}
