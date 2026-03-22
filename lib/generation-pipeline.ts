import { prisma } from "./prisma";
import fs from "fs/promises";
import path from "path";

export async function runGenerationPipeline(jobId: string) {
  try {
    await prisma.generationJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    await new Promise((res) => setTimeout(res, 3000));

    const batchSize = job.batchSize;
    const outputs = [];

    for (let i = 0; i < batchSize; i++) {
      const assetId = Math.random().toString(36).substring(2, 9);
      const dir = path.join(process.cwd(), "public", "storage", job.brandId, job.productId, job.id);
      await fs.mkdir(dir, { recursive: true });

      const fileName = `${assetId}.jpg`;
      const filePath = path.join(dir, fileName);

      const imgRes = await fetch(`https://picsum.photos/seed/${jobId}-${i}/400/400`);
      const arrayBuffer = await imgRes.arrayBuffer();
      await fs.writeFile(filePath, Buffer.from(arrayBuffer));

      const publicUrl = `/storage/${job.brandId}/${job.productId}/${job.id}/${fileName}`;

      outputs.push({
        generationJobId: job.id,
        filePath: publicUrl,
        thumbPath: publicUrl,
        width: 400,
        height: 400,
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

    await new Promise((res) => setTimeout(res, 3000));

    const assetId = Math.random().toString(36).substring(2, 9);
    const dir = path.join(process.cwd(), "public", "storage", job.brandId, job.productId, job.id);
    await fs.mkdir(dir, { recursive: true });

    const fileName = `${assetId}.jpg`;
    const filePath = path.join(dir, fileName);

    const imgRes = await fetch(`https://picsum.photos/seed/${parentOutputId}-${assetId}/400/400`);
    const arrayBuffer = await imgRes.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));

    const publicUrl = `/storage/${job.brandId}/${job.productId}/${job.id}/${fileName}`;

    const newOutput = await prisma.generationOutput.create({
      data: {
        generationJobId: job.id,
        parentOutputId: parent.id,
        versionNo: parent.versionNo + 1,
        filePath: publicUrl,
        thumbPath: publicUrl,
        width: 400,
        height: 400,
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
