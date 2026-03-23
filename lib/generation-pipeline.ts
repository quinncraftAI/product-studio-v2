import { prisma } from "./prisma";
import fs from "fs/promises";
import path from "path";

async function generateAndSaveImage(prompt: string, dir: string, assetId: string): Promise<{ fileName: string; width: number; height: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1", outputOptions: { mimeType: "image/jpeg" } },
      }),
    }
  );

  const json = await response.json();
  const base64 = json.predictions[0].bytesBase64Encoded;

  const fileName = `${assetId}.jpg`;
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
