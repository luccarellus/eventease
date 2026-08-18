import "dotenv/config";
import dns from "dns";
import { defineConfig } from "@prisma/config";

// Garante que o Prisma CLI (migrate deploy) use IPv4 na VPS sem rota IPv6
dns.setDefaultResultOrder("ipv4first");

export default defineConfig({
  schema: "backend/prisma/schema.prisma",
  migrations: {
    seed: "npx ts-node --transpile-only backend/prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
