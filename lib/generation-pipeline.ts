import { prisma } from "./prisma";
import fs from "fs/promises";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAndSaveImage(prompt: string, dir: string, assetId: string): Promise<{ fileName: string; width: number; height: number }> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    response_format: "url",
  });

  const imageUrl = response.data[0].url!;
  const imgRes = await fetch(imageUrl);
  const arrayBuffer = await imgRes.arrayBuffer();

  const fileName = `${assetId}.png`;
  await fs.writeFile(path.join(dir, fileName), Buffer.from(arrayBuffer));

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
    const prompt = job.promptRaw || `Generate a professional ${job.mode} image for brand ${job.brandId}`;

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
        mimeType: "image/png",
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
        mimeType: "image/png",
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
