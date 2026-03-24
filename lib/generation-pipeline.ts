import { prisma } from "./prisma";
import { saveImage } from "./storage";

export async function enhancePrompt(
  rawPrompt: string,
  params: { lighting?: string; mode?: string; product?: string; brand?: string; referenceImageUrl?: string | null }
): Promise<string> {
  const contextParts = [
    params.mode && `Mode: ${params.mode}`,
    params.product && `Product: ${params.product}`,
    params.brand && `Brand: ${params.brand}`,
    params.lighting && `Lighting: ${params.lighting}`,
    params.referenceImageUrl && `Reference product image: ${params.referenceImageUrl}`,
  ].filter(Boolean).join(", ");

  const systemInstruction = `You are an expert image generation prompt engineer. Given a raw prompt and context, output exactly 2 sentences that form a highly optimized, vivid image generation prompt. Be specific about composition, lighting, style, and quality. Output only the 2-sentence prompt, nothing else.`;

  const userMessage = `Raw prompt: "${rawPrompt}"\nContext: ${contextParts || "none"}\n\nWrite the optimized 2-sentence image generation prompt:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
  assetId: string
): Promise<{ publicUrl: string; width: number; height: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  const json: any = await response.json();
  if (!response.ok) {
    throw new Error(`Gemini Image API Error: ${JSON.stringify(json)}`);
  }

  const part = json.candidates?.[0]?.content?.parts?.[0];
  const base64 = part?.inline_data?.data || part?.data;

  if (!base64) {
    throw new Error("No image data found in Gemini response");
  }

  const fileName = `${assetId}.png`;
  const { url } = await saveImage(Buffer.from(base64, "base64"), [...keyPrefix, fileName]);

  return { publicUrl: url, width: 1024, height: 1024 };
}

export async function runGenerationPipeline(jobId: string) {
  console.log(`Pipeline: Starting job ${jobId}`);
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
    let prompt = job.promptRaw || `Professional ${job.mode} photography`;

    if (params.useEnhancer) {
      prompt = await enhancePrompt(prompt, {
        lighting: params.lighting,
        mode: job.mode,
        product: job.product?.name,
        brand: job.brand?.name,
        referenceImageUrl: job.referenceImageUrl,
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

      const { publicUrl, width, height } = await generateAndSaveImage(prompt, keyPrefix, assetId);

      await prisma.generationOutput.create({
        data: {
          generationJobId: job.id,
          filePath: publicUrl,
          thumbPath: publicUrl,
          width,
          height,
          mimeType: "image/png",
          approvalState: "pending",
        },
      });
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "completed", completedAt: new Date() },
    });
    console.log(`Pipeline: Job ${jobId} completed`);
  } catch (err) {
    console.error("Pipeline failed:", err);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "failed", errorText: String(err) },
    }).catch(console.error);
  }
}

export async function runRegenerationPipeline(parentOutputId: string, instructionText: string) {
  const parent = await prisma.generationOutput.findUnique({
    where: { id: parentOutputId },
    include: { generationJob: true },
  });
  if (!parent) throw new Error("Parent output not found");

  const job = parent.generationJob;
  const assetId = Math.random().toString(36).substring(2, 9);
  const keyPrefix = [job.brandId || "unbranded", job.productId || "unnamed", job.id];

  const { publicUrl, width, height } = await generateAndSaveImage(instructionText, keyPrefix, assetId);

  return prisma.generationOutput.create({
    data: {
      generationJobId: job.id,
      parentOutputId: parent.id,
      versionNo: parent.versionNo + 1,
      filePath: publicUrl,
      thumbPath: publicUrl,
      width,
      height,
      mimeType: "image/png",
      approvalState: "pending",
      metadataJson: JSON.stringify({ instruction: instructionText }),
    },
  });
}
