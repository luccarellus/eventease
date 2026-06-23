import "dotenv/config";
import { defineConfig } from "@prisma/config";

export default defineConfig({
  schema: "backend/prisma/schema.prisma",
  migrations: {
    seed: "npx ts-node --transpile-only backend/prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
    directUrl: process.env["DIRECT_URL"],
  },
});
