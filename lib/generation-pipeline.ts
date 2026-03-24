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
  console.log(`Gemini API: Generating image with prompt: "${prompt.substring(0, 100)}..."`);
  
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
    console.error("Gemini Image API Error Response:", JSON.stringify(json, null, 2));
    throw new Error(`Gemini Image API Error: ${json.error?.message || response.statusText}`);
  }

  // Permissive extraction of image data (handles snake_case and camelCase)
  let base64: string | undefined;
  
  const candidates = json.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      // Check inline_data (snake_case)
      if (part.inline_data?.data) {
        base64 = part.inline_data.data;
        break;
      }
      // Check inlineData (camelCase)
      if (part.inlineData?.data) {
        base64 = part.inlineData.data;
        break;
      }
      // Check direct data field (fallback)
      if (part.data) {
        base64 = part.data;
        break;
      }
    }
    if (base64) break;
  }

  if (!base64) {
    console.error("Gemini API Full JSON (No Image Found):", JSON.stringify(json, null, 2));
    throw new Error("No image data found in Gemini API response (scanned candidates/parts/inlineData)");
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
    if (!job) {
        console.error(`Pipeline Error: Job ${jobId} not found in database`);
        return;
    }

    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    const params = job.paramsJson ? JSON.parse(job.paramsJson as string) : {};
    let prompt = job.promptRaw || `Professional ${job.mode} photography`;

    if (params.useEnhancer) {
      console.log(`Pipeline: Enhancing prompt for job ${jobId}`);
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
    console.log(`Pipeline: Job ${jobId} completed successfully`);
  } catch (err) {
    console.error(`Pipeline Error (Job ${jobId}):`, err);
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { 
          status: "failed", 
          errorText: err instanceof Error ? err.message : String(err) 
      },
    }).catch(e => console.error("Critical: Failed to update job status to FAILED", e));
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
