-- AlterTable: email de participantes passa a ser UNIQUE
-- (a @@index não-única original se torna redundante)

-- DropIndex
DROP INDEX "participantes_email_idx";

-- AlterTable
ALTER TABLE "participantes" ADD CONSTRAINT "participantes_email_key" UNIQUE ("email");
