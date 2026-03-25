import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const brands = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: {
      products: {
        orderBy: { name: "asc" },
        include: {
          generationJobs: {
            where: {
              outputs: {
                some: { approvalState: "approved" },
              },
            },
            include: {
              outputs: {
                where: { approvalState: "approved" },
                orderBy: { createdAt: "desc" },
              },
            },
          },
        },
      },
    },
  });

  // Filter out brands/products with no approved outputs
  const data = brands
    .map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      products: brand.products
        .map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          outputs: product.generationJobs.flatMap((job) =>
            job.outputs.map((output) => ({
              id: output.id,
              filePath: output.filePath,
              thumbPath: output.thumbPath,
              width: output.width,
              height: output.height,
              mode: job.mode,
              jobId: job.id,
              createdAt: output.createdAt,
            })),
          ),
        }))
        .filter((p) => p.outputs.length > 0),
    }))
    .filter((b) => b.products.length > 0);

  return NextResponse.json({ data });
}
