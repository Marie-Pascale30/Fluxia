-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "portalVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "decisionBy" TEXT,
ADD COLUMN     "decisionNote" TEXT;
