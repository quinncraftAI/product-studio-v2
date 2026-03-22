import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  const resolvedParams = await params;
  const { id, action } = resolvedParams;

  const validStates = ["pending", "approved", "rejected"];
  if (!validStates.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const output = await prisma.generationOutput.update({
      where: { id },
      data: { approvalState: action as "pending" | "approved" | "rejected" },
    });
    return NextResponse.json({ data: output });
  } catch (error) {
    console.error("Failed to update approval state", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
