# Deployment Guide

This guide covers migrating from the local SQLite dev setup to a production-ready
stack on **Vercel** + **Supabase** (PostgreSQL + Storage).

---

## 1. Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://user:pass@host:5432/db?sslmode=require`) |
| `GEMINI_API_KEY` | Google Gemini API key used for prompt enhancement and image generation |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret — server-side only, never expose to the browser |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (only needed if using Vercel Blob instead of Supabase Storage) |

---

## 2. Migrate Prisma from SQLite → PostgreSQL

### 2a. Install the PostgreSQL driver

```bash
npm install @prisma/adapter-pg pg
npm uninstall @prisma/adapter-better-sqlite3 better-sqlite3
```

### 2b. Update `prisma/schema.prisma`

Change the datasource block:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

### 2c. Update `lib/prisma.ts`

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/app/generated/prisma/client";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma =
  global.__prisma__ ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
```

### 2d. Create and apply the migration

```bash
# Generate a new migration against the PostgreSQL database
npx prisma migrate dev --name init

# In CI / production (no shadow database needed)
npx prisma migrate deploy
```

---

## 3. Configure Cloud Image Storage

Open `lib/storage.ts` and replace the `throw` in the cloud branch with your
provider of choice.

### Option A — Supabase Storage

```bash
npm install @supabase/supabase-js
```

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await supabase.storage
  .from("images")
  .upload(keySegments.join("/"), imageBuffer, {
    contentType: "image/png",
    upsert: true,
  });
if (error) throw error;

const { data: { publicUrl } } = supabase.storage
  .from("images")
  .getPublicUrl(data.path);

return { url: publicUrl };
```

Create a **public** bucket named `images` in your Supabase dashboard (Storage →
New bucket → enable "Public bucket").

### Option B — Vercel Blob

```bash
npm install @vercel/blob
```

```ts
import { put } from "@vercel/blob";

const blob = await put(keySegments.join("/"), imageBuffer, { access: "public" });
return { url: blob.url };
```

Set `BLOB_READ_WRITE_TOKEN` in your Vercel project settings.

---

## 4. Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link the project
vercel link

# Add environment variables
vercel env add DATABASE_URL
vercel env add GEMINI_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY   # if using Supabase Storage

# Deploy
vercel --prod
```

Alternatively, push to your linked GitHub repo and Vercel will build and deploy
automatically on every push to `main`.

### Post-deploy checklist

- [ ] `DATABASE_URL` points to the Supabase/Postgres connection string with `sslmode=require`
- [ ] `npx prisma migrate deploy` has been run against the production database
- [ ] Cloud storage bucket is public and CORS is configured for your Vercel domain
- [ ] `GEMINI_API_KEY` has quota sufficient for production traffic
- [ ] Remove `public/storage/` from the repository (or add it to `.gitignore`) once cloud storage is live
