-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "serviceIntervalMonths" INTEGER;

-- AlterTable
ALTER TABLE "Intervention" ADD COLUMN     "contractId" TEXT;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
