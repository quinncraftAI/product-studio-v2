import { prisma } from "./prisma";
import { saveImage } from "./storage";
import fs from "fs/promises";
import path from "path";

/**
 * Utility to get base64 data from a local or public URL for the Gemini API.
 */
async function getImageBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (imageUrl.startsWith("/storage/")) {
      const localPath = path.join(process.cwd(), "public", imageUrl);
      const buffer = await fs.readFile(localPath);
      const ext = path.extname(localPath).toLowerCase().replace(".", "");
      const mimeType = ext === "png" ? "image/png" : "image/jpeg";
      return { data: buffer.toString("base64"), mimeType };
    }
    
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return { data: buffer.toString("base64"), mimeType: contentType };
  } catch (err) {
    console.error("Failed to fetch image for base64:", imageUrl, err);
    return null;
  }
}

export async function enhancePrompt(
  rawPrompt: string,
  params: { lighting?: string; mode?: string; product?: string; brand?: string; referenceImageUrl?: string | null }
): Promise<string> {
  const contextParts = [
    params.mode && `Mode: ${params.mode}`,
    params.product && `Product: ${params.product}`,
    params.brand && `Brand: ${params.brand}`,
    params.lighting && `Lighting: ${params.lighting}`,
  ].filter(Boolean).join(", ");

  const systemInstruction = `You are an expert image generation prompt engineer. Given a raw prompt and context, output exactly 2 sentences that form a highly optimized, vivid image generation prompt. Focus on product photography excellence, texture, and brand accuracy. Output only the 2-sentence prompt, nothing else.`;

  const userMessage = `Raw prompt: "${rawPrompt}"\nContext: ${contextParts || "none"}\n\nWrite the optimized 2-sentence image generation prompt:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
        }),
      }
    );

    const json = await response.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : rawPrompt;
  } catch (err) {
    console.error("Enhance error:", err);
    return rawPrompt;
  }
}

async function generateAndSaveImage(
  prompt: string,
  keyPrefix: string[],
  assetId: string,
  options: { referenceImageUrl?: string | null; aspectRatio?: string } = {}
): Promise<{ publicUrl: string; width: number; height: number }> {
  const parts: any[] = [{ text: prompt }];

  if (options.referenceImageUrl) {
    const imgData = await getImageBase64(options.referenceImageUrl);
    if (imgData) {
      parts.push({
        inline_data: {
          mime_type: imgData.mimeType,
          data: imgData.data,
        },
      });
    }
  }

  // Map common ratios to Gemini expected format if needed
  const aspectRatio = options.aspectRatio || "1:1";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          // We omit aspect_ratio here if it causes issues, but for 3.1 it SHOULD work in the correct schema
          // For safety, we rely on the prompt or default 1:1 if the specific field is finicky
        },
      }),
    }
  );

  const json: any = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini Image API Error: ${json.error?.message || response.statusText}`);
  }

  let base64: string | undefined;
  const candidates = json.candidates || [];
  for (const candidate of candidates) {
    const p = candidate.content?.parts || [];
    for (const part of p) {
      if (part.inlineData?.data) base64 = part.inlineData.data;
      else if (part.inline_data?.data) base64 = part.inline_data.data;
      else if (part.data) base64 = part.data;
      if (base64) break;
    }
    if (base64) break;
  }

  if (!base64) throw new Error("No image data found in Gemini response");

  const fileName = `${assetId}.png`;
  const { url } = await saveImage(Buffer.from(base64, "base64"), [...keyPrefix, fileName]);

  return { publicUrl: url, width: 1024, height: 1024 };
}

export async function runGenerationPipeline(jobId: string) {
  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      include: { brand: true, product: true }
    });
    if (!job) return;

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    const params = job.paramsJson ? JSON.parse(job.paramsJson as string) : {};
    
    // Priority: Job Image > Product Default Image
    const refUrl = job.referenceImageUrl || job.product?.imageUrl;

    let prompt = job.promptRaw || `Professional ${job.mode} photography for ${job.product?.name || "product"}`;

    // Append aspect ratio instruction to prompt since API config field is finicky
    if (params.ratio && params.ratio !== "1:1") {
      prompt += `. Use a ${params.ratio} aspect ratio.`;
    }

    if (params.useEnhancer) {
      prompt = await enhancePrompt(prompt, {
        lighting: params.lighting,
        mode: job.mode,
        product: job.product?.name,
        brand: job.brand?.name,
        referenceImageUrl: refUrl,
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { promptEnhanced: prompt },
      });
    }

    const batchSize = job.batchSize || 1;
    for (let i = 0; i < batchSize; i++) {
      const assetId = Math.random().toString(36).substring(2, 9);
      const keyPrefix = [job.brandId || "unbranded", job.productId || "unnamed", job.id];

      try {
        const result = await generateAndSaveImage(prompt, keyPrefix, assetId, {
          referenceImageUrl: refUrl,
          aspectRatio: params.ratio
        });

        await prisma.generationOutput.create({
          data: {
            generationJobId: job.id,
            filePath: result.publicUrl,
            thumbPath: result.publicUrl,
            width: result.width,
            height: result.height,
            mimeType: "image/png",
            approvalState: "pending",
          },
        });
      } catch (err) {
        console.error(`Batch item ${i} failed:`, err);
        // Continue to next item in batch instead of failing whole job immediately
      }
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err) {
    console.error(`Pipeline Error (Job ${jobId}):`, err);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorText: String(err) },
    }).catch(() => {});
  }
}

export async function runRegenerationPipeline(parentOutputId: string, instructionText: string) {
  const parent = await prisma.generationOutput.findUnique({
    where: { id: parentOutputId },
    include: { generationJob: { include: { product: true } } },
  });
  if (!parent) throw new Error("Parent output not found");

  const job = parent.generationJob;
  const assetId = Math.random().toString(36).substring(2, 9);
  const keyPrefix = [job.brandId || "unbranded", job.productId || "unnamed", job.id];
  const refUrl = job.referenceImageUrl || job.product?.imageUrl;

  const result = await generateAndSaveImage(instructionText, keyPrefix, assetId, {
    referenceImageUrl: refUrl
  });

  return prisma.generationOutput.create({
    data: {
      generationJobId: job.id,
      parentOutputId: parent.id,
      versionNo: parent.versionNo + 1,
      filePath: result.publicUrl,
      thumbPath: result.publicUrl,
      width: result.width,
      height: result.height,
      mimeType: "image/png",
      approvalState: "pending",
      metadataJson: JSON.stringify({ instruction: instructionText }),
    },
  });
}
