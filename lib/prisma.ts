import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

// Only initialize Prisma on the server
let prisma: PrismaClient;

if (typeof window === "undefined") {
  const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
  const path = require("path");

  const rawUrl = process.env.DATABASE_URL || "file:./dev.db";
  const connectionUrl = rawUrl.replace(/^file:/, "");
  const dbPath = path.isAbsolute(connectionUrl) 
    ? connectionUrl 
    : path.join(process.cwd(), connectionUrl);

  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

  prisma =
    global.__prisma__ ??
    new PrismaClient({
      adapter,
    });

  if (process.env.NODE_ENV !== "production") {
    global.__prisma__ = prisma;
  }
} else {
  // Dummy client for browser if somehow imported
  prisma = {} as any;
}

export { prisma };
