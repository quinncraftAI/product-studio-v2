import fs from "fs/promises";
import path from "path";

export interface SaveImageResult {
  /** Public URL or cloud URL that can be stored in the database */
  url: string;
}

/**
 * Saves a raw image buffer and returns a publicly accessible URL.
 *
 * In development (NODE_ENV === "development") images are written to
 * `public/storage/…` so Next.js serves them statically.
 *
 * In production, swap the "cloud" branch below for your chosen provider
 * (Vercel Blob, Supabase Storage, S3, Cloudinary, etc.).
 */
export async function saveImage(
  imageBuffer: Buffer,
  /** Path segments that form the storage key, e.g. [brandId, productId, jobId, fileName] */
  keySegments: string[]
): Promise<SaveImageResult> {
  if (process.env.NODE_ENV === "development") {
    return saveImageLocally(imageBuffer, keySegments);
  }

  // ── Cloud branch ────────────────────────────────────────────────────────────
  // Replace this block with your cloud provider SDK call.
  //
  // Example — Vercel Blob:
  //   import { put } from "@vercel/blob";
  //   const blob = await put(keySegments.join("/"), imageBuffer, { access: "public" });
  //   return { url: blob.url };
  //
  // Example — Supabase Storage:
  //   import { createClient } from "@supabase/supabase-js";
  //   const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  //   const { data, error } = await supabase.storage
  //     .from("images")
  //     .upload(keySegments.join("/"), imageBuffer, { contentType: "image/png", upsert: true });
  //   if (error) throw error;
  //   const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(data.path);
  //   return { url: publicUrl };
  // ────────────────────────────────────────────────────────────────────────────

  throw new Error(
    "Cloud storage is not configured. " +
    "Implement the cloud branch in lib/storage.ts and set the required environment variables."
  );
}

async function saveImageLocally(
  imageBuffer: Buffer,
  keySegments: string[]
): Promise<SaveImageResult> {
  const relativePath = path.join("public", "storage", ...keySegments);
  const absoluteDir = path.join(process.cwd(), path.dirname(relativePath));
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(path.join(process.cwd(), relativePath), imageBuffer);

  // Return a URL relative to the public root (Next.js serves /public as /)
  const url = "/" + ["storage", ...keySegments].join("/");
  return { url };
}
