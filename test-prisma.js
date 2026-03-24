const { PrismaClient } = require("./node_modules/@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

const prisma = new PrismaClient({ adapter });

async function main() {
  const jobs = await prisma.generationJob.findMany({
    take: 1,
  });
  console.log("JOBS FOUND:", jobs.length);
}

main().catch(console.error);
