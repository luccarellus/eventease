import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
