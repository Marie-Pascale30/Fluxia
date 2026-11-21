-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "siret" TEXT,
ADD COLUMN     "vatNumber" TEXT;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "siret" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vatNumber" TEXT NOT NULL DEFAULT '';

