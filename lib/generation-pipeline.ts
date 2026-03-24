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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

async function generateAndSaveImage(
  prompt: string,
  keyPrefix: string[],
  assetId: string,
  options: { aspectRatio?: string } = {}
): Promise<{ publicUrl: string; width: number; height: number }> {
  // Use Gemini 3.1 Flash Image Preview (Nano Banana 2)
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: { 
          response_mime_type: "image/png",
          aspect_ratio: options.aspectRatio || "1:1",
          resolution: "1K"
        },
      }),
    }
  );

  const json = await response.json();

  if (!response.ok || !json.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data) {
    console.error("Gemini Image API Error:", JSON.stringify(json, null, 2));
    throw new Error(json.error?.message || "Failed to generate image from Gemini 3.1 Image API");
  }

  const base64 = json.candidates[0].content.parts[0].inline_data.data;
  const fileName = `${assetId}.png`;

  const { url } = await saveImage(Buffer.from(base64, "base64"), [...keyPrefix, fileName]);

  return { publicUrl: url, width: 1024, height: 1024 };
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
    const rawPrompt = job.promptRaw || `Generate a professional ${job.mode} image`;

    const params = job.paramsJson ? JSON.parse(job.paramsJson as string) : {};
    let prompt = rawPrompt;
    if (params.useEnhancer) {
      prompt = await enhancePrompt(rawPrompt, {
        lighting: params.lighting,
        mode: job.mode,
        product: job.productId || undefined,
        brand: job.brandId || undefined,
        referenceImageUrl: job.referenceImageUrl,
      });
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { promptEnhanced: prompt },
      });
    } else if (job.referenceImageUrl) {
      prompt = `${prompt}. Reference product image: ${job.referenceImageUrl}`;
    }

    for (let i = 0; i < batchSize; i++) {
      const assetId = Math.random().toString(36).substring(2, 9);
      const keyPrefix = [job.brandId || "unbranded", job.productId || "unnamed", job.id];

      const { publicUrl, width, height } = await generateAndSaveImage(prompt, keyPrefix, assetId, {
        aspectRatio: params.ratio
      });

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
    const keyPrefix = [job.brandId || "unbranded", job.productId || "unnamed", job.id];

    const prompt = instructionText || job.promptRaw || `Generate a professional ${job.mode} image`;
    const { publicUrl, width, height } = await generateAndSaveImage(prompt, keyPrefix, assetId);

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
