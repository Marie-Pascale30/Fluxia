-- AlterEnum
ALTER TYPE "RequestStatus" ADD VALUE 'ANSWERED';

-- AlterTable
ALTER TABLE "InboundRequest" ADD COLUMN     "extractedAddress" TEXT,
ADD COLUMN     "extractedPhone" TEXT;
