import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: brands });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body?.name ?? "").trim();
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const brandGuidelinesJson = body?.brandGuidelinesJson
    ? JSON.stringify(body.brandGuidelinesJson)
    : null;

  if (!name || !slug) {
    return NextResponse.json(
      { error: "name and slug are required" },
      { status: 400 },
    );
  }

  const brand = await prisma.brand.create({
    data: {
      name,
      slug,
      brandGuidelinesJson,
    },
  });

  return NextResponse.json({ data: brand }, { status: 201 });
}
