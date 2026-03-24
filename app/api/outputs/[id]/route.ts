import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const output = await prisma.generationOutput.findUnique({
      where: { id },
    });

    if (!output) {
      return NextResponse.json({ error: "Output not found" }, { status: 404 });
    }

    // 1. Delete the record from database
    await prisma.generationOutput.delete({
      where: { id },
    });

    // 2. Delete file from disk if it exists locally
    // Output filePath usually starts with "/storage/..."
    if (output.filePath.startsWith("/storage/")) {
      const localPath = path.join(process.cwd(), "public", output.filePath);
      try {
        await fs.unlink(localPath);
        // Also delete thumbnail if different
        if (output.thumbPath && output.thumbPath !== output.filePath && output.thumbPath.startsWith("/storage/")) {
          await fs.unlink(path.join(process.cwd(), "public", output.thumbPath));
        }
      } catch (err) {
        console.warn(`Could not delete file at ${localPath}:`, err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete output error:", error);
    return NextResponse.json({ error: "Failed to delete output" }, { status: 500 });
  }
}
