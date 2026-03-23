import { NextResponse } from "next/server";
import { saveImage } from "@/lib/storage";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const id = Math.random().toString(36).substring(2, 10);
  const fileName = `${id}.${ext}`;

  const { url } = await saveImage(buffer, ["uploads", fileName]);

  return NextResponse.json({ url }, { status: 201 });
}
