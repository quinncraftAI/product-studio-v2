import { NextResponse } from "next/server";
import { runRegenerationPipeline } from "@/lib/generation-pipeline";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const parentId = resolvedParams.id;

  const body = await request.json();
  const instructionText = String(body.instructionText || "").trim();

  if (!instructionText) {
    return NextResponse.json({ error: "Instruction text required" }, { status: 400 });
  }

  try {
    const newOutput = await runRegenerationPipeline(parentId, instructionText);
    return NextResponse.json({ data: newOutput });
  } catch (error) {
    console.error("Regeneration failed", error);
    return NextResponse.json({ error: "Regeneration failed" }, { status: 500 });
  }
}
