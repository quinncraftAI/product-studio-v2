import { prisma } from "./prisma";
import fs from "fs/promises";
import path from "path";

export async function enhancePrompt(
  rawPrompt: string,
  params: { lighting?: string; mode?: string; product?: string; brand?: string }
): Promise<string> {
  const contextParts = [
    params.mode && `Mode: ${params.mode}`,
    params.product && `Product: ${params.product}`,
    params.brand && `Brand: ${params.brand}`,
    params.lighting && `Lighting: ${params.lighting}`,
  ].filter(Boolean).join(", ");

  const systemInstruction = `You are an expert image generation prompt engineer. Given a raw prompt and context, output exactly 2 sentences that form a highly optimized, vivid image generation prompt. Be specific about composition, lighting, style, and quality. Output only the 2-sentence prompt, nothing else.`;

  const userMessage = `Raw prompt: "${rawPrompt}"\nContext: ${contextParts || "none"}\n\nWrite the optimized 2-sentence image generation prompt:`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
  if (!response.ok || !json.candidates?.[0]?.content?.parts?.[0]?.text) {
    console.error("Gemini enhance error:", JSON.stringify(json, null, 2));
    return rawPrompt;
  }

  return json.candidates[0].content.parts[0].text.trim();
}

async function generateAndSaveImage(prompt: string, dir: string, assetId: string): Promise<{ fileName: string; width: number; height: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:predict?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/png" } },
      }),
    }
  );

  const json = await response.json();
  
  if (!response.ok || !json.predictions || !json.predictions[0]) {
    console.error("Imagen API Error:", JSON.stringify(json, null, 2));
    throw new Error(json.error?.message || "Failed to generate image from Imagen API");
  }

  const base64 = json.predictions[0].bytesBase64Encoded;

  const fileName = `${assetId}.png`;
  await fs.writeFile(path.join(dir, fileName), Buffer.from(base64, "base64"));

  return { fileName, width: 1024, height: 1024 };
}

export async function runGenerationPipeline(jobId: string) {
  try {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const batchSize = job.batchSize;
    const outputs = [];
    const rawPrompt = job.promptRaw || `Generate a professional ${job.mode} image for brand ${job.brandId}`;

    const params = job.paramsJson ? JSON.parse(job.paramsJson as string) : {};
    let prompt = rawPrompt;
    if (params.useEnhancer) {
      prompt = await enhancePrompt(rawPrompt, {
        lighting: params.lighting,
        mode: job.mode,
        product: job.productId,
        brand: job.brandId,
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { promptEnhanced: prompt },
      });
    }

    for (let i = 0; i < batchSize; i++) {
      const assetId = Math.random().toString(36).substring(2, 9);
      const dir = path.join(process.cwd(), "public", "storage", job.brandId, job.productId, job.id);
      await fs.mkdir(dir, { recursive: true });

      const { fileName, width, height } = await generateAndSaveImage(prompt, dir, assetId);
      const publicUrl = `/storage/${job.brandId}/${job.productId}/${job.id}/${fileName}`;

      outputs.push({
        generationJobId: job.id,
        filePath: publicUrl,
        thumbPath: publicUrl,
        width,
        height,
        mimeType: "image/jpeg",
        approvalState: "pending",
      });
    }

    for (const output of outputs) {
      await prisma.generationOutput.create({ data: output as any });
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
  } catch (err) {
    console.error("Pipeline error:", err);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorText: String(err) },
    });
  }
}

export async function runRegenerationPipeline(parentOutputId: string, instructionText: string) {
  try {
    const parent = await prisma.generationOutput.findUnique({
      where: { id: parentOutputId },
      include: { generationJob: true },
    });

    if (!parent) throw new Error("Parent output not found");
    const job = parent.generationJob;

    const assetId = Math.random().toString(36).substring(2, 9);
    const dir = path.join(process.cwd(), "public", "storage", job.brandId, job.productId, job.id);
    await fs.mkdir(dir, { recursive: true });

    const prompt = instructionText || job.promptRaw || `Generate a professional ${job.mode} image for brand ${job.brandId}`;
    const { fileName, width, height } = await generateAndSaveImage(prompt, dir, assetId);
    const publicUrl = `/storage/${job.brandId}/${job.productId}/${job.id}/${fileName}`;

    const newOutput = await prisma.generationOutput.create({
      data: {
        generationJobId: job.id,
        parentOutputId: parent.id,
        versionNo: parent.versionNo + 1,
        filePath: publicUrl,
        thumbPath: publicUrl,
        width,
        height,
        mimeType: "image/jpeg",
        approvalState: "pending",
        metadataJson: JSON.stringify({ instruction: instructionText }),
      },
    });

    return newOutput;
  } catch (err) {
    console.error("Regeneration error:", err);
    throw err;
  }
}
