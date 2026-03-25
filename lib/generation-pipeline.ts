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
  let modeSpecificInstructions = "";
  if (params.mode === "social_post") {
    modeSpecificInstructions = `5. SOCIAL MEDIA POST MODE (PINTEREST/IG AESTHETIC): You MUST use your Google Search tool to look up current viral Pinterest aesthetics for this specific product/category. Analyze the current trending visual composition, micro-environments, authentic lifestyle integration, soft aesthetic lighting, and trendy props. Apply these exact findings to the prompt. The aesthetic MUST be highly engaging and native to platforms like Instagram or TikTok, avoiding sterile catalog shots.
6. TYPOGRAPHY REQUIRED: You MUST include instructions to render text on the image. Specify a short, catchy brand hook or aesthetic phrase (e.g., "The words 'New Arrival' written in elegant modern typography").`;
  } else if (params.mode === "performance_creative") {
    modeSpecificInstructions = `5. PERFORMANCE CREATIVE MODE (HIGH-CONVERTING AD): You MUST use your Google Search tool to look up top-performing Facebook/Instagram ad creative trends for this specific product/category. The image MUST be high-contrast, scroll-stopping, and designed to drive conversions based on real-world native media buying trends. Use strong visual hierarchy, bold color contrasts, and clear product focus.
6. TYPOGRAPHY REQUIRED: You MUST include instructions for strong Call-To-Action (CTA) text overlay. Specify exact selling text (e.g., "The text '50% OFF' displayed prominently in bold, high-contrast typography").`;
  }

  const lightingInstruction = params.lighting
    ? `3. LIGHTING REQUIREMENT: You MUST strictly apply the exact lighting style requested: "${params.lighting}". This lighting must dictate the primary mood, shadows, and highlights of the entire scene, overriding any generic lighting.`
    : `3. LIGHTING: Apply lighting appropriate for the scene.`;

  const contextParts = [
    params.mode && `Mode: ${params.mode}`,
    params.product && `Product: ${params.product}`,
    params.brand && `Brand: ${params.brand}`,
    params.lighting && `Lighting: ${params.lighting}`,
  ].filter(Boolean).join(", ");

  const systemInstruction = `You are an expert image generation prompt engineer for high-end product photography.
Your goal is to rewrite the user's raw prompt into a highly optimized, vivid image generation prompt tailored for an advanced AI image generator that can render text.

CRITICAL INSTRUCTIONS:
1. PRODUCT ACCURACY: You must thoroughly understand the product and brand. The product's core identity, shape, branding, and function MUST remain the exact focal point. Do not invent features, change its fundamental design, or add irrelevant objects that distract from the main product.
2. STRUCTURE: Start with a clear description of the main subject (the product), followed by its placement/environment, then lighting and camera details, and finally any typography/text instructions.
${lightingInstruction}
4. ALIGNMENT: Strictly adhere to the requested "Mode" (e.g., flatlay, lifestyle, white_bg). If it's lifestyle, seamlessly integrate the product into a realistic, culturally appropriate scene.
${modeSpecificInstructions}

Output exactly 3 to 5 sentences forming the final prompt. Output ONLY the optimized prompt, with no introductory text. Enclose any specific text meant to be rendered on the image in double quotes.`;

  const userMessage = `Raw prompt: "${rawPrompt}"\nContext: ${contextParts || "none"}\n\nWrite the optimized image generation prompt:`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          tools: [{ googleSearch: {} }],
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

  const aspectRatio = options.aspectRatio || "1:1";

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: {
            aspectRatio,
          },
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
      // Add a small delay between batch items to prevent rate limiting
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 1500));

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
  
  // Extract ratio from original job params
  const params = job.paramsJson ? JSON.parse(job.paramsJson as string) : {};

  const result = await generateAndSaveImage(instructionText, keyPrefix, assetId, {
    referenceImageUrl: refUrl,
    aspectRatio: params.ratio
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
