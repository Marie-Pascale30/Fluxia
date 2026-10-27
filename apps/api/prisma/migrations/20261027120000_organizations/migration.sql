-- Multi-entreprise : chaque donnée métier est rattachée à une entreprise (Organization).

-- Les données existantes sont rattachées à une première entreprise « Mon entreprise ».



-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "legal" TEXT NOT NULL DEFAULT '',
    "signature" TEXT NOT NULL DEFAULT 'L''équipe maintenance',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "accountRevenue" TEXT NOT NULL DEFAULT '706000',
    "accountVat" TEXT NOT NULL DEFAULT '445710',
    "inboundToken" TEXT NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_inboundToken_key" ON "Organization"("inboundToken");

-- Entreprise d'accueil des données existantes (uniquement si la base contient déjà des données)
INSERT INTO "Organization" ("id", "name", "inboundToken")
SELECT 'org_initiale', 'Mon entreprise', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Client") OR EXISTS (SELECT 1 FROM "Technician")
   OR EXISTS (SELECT 1 FROM "CatalogItem") OR EXISTS (SELECT 1 FROM "InboundRequest") OR EXISTS (SELECT 1 FROM "Counter")
   OR EXISTS (SELECT 1 FROM "Activity") OR EXISTS (SELECT 1 FROM "OutboundMessage");

-- Colonne organizationId : ajoutée, renseignée, puis rendue obligatoire.
-- Le défaut vaut toujours NULL (réglage jamais défini) : une création hors contexte d'entreprise échoue.

ALTER TABLE "Activity" ADD COLUMN "organizationId" TEXT;
UPDATE "Activity" SET "organizationId" = 'org_initiale';
ALTER TABLE "Activity" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Attachment" ADD COLUMN "organizationId" TEXT;
UPDATE "Attachment" SET "organizationId" = 'org_initiale';
ALTER TABLE "Attachment" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "CatalogItem" ADD COLUMN "organizationId" TEXT;
UPDATE "CatalogItem" SET "organizationId" = 'org_initiale';
ALTER TABLE "CatalogItem" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Client" ADD COLUMN "organizationId" TEXT;
UPDATE "Client" SET "organizationId" = 'org_initiale';
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Contract" ADD COLUMN "organizationId" TEXT;
UPDATE "Contract" SET "organizationId" = 'org_initiale';
ALTER TABLE "Contract" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Equipment" ADD COLUMN "organizationId" TEXT;
UPDATE "Equipment" SET "organizationId" = 'org_initiale';
ALTER TABLE "Equipment" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "InboundRequest" ADD COLUMN "organizationId" TEXT;
UPDATE "InboundRequest" SET "organizationId" = 'org_initiale';
ALTER TABLE "InboundRequest" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Intervention" ADD COLUMN "organizationId" TEXT;
UPDATE "Intervention" SET "organizationId" = 'org_initiale';
ALTER TABLE "Intervention" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Invoice" ADD COLUMN "organizationId" TEXT;
UPDATE "Invoice" SET "organizationId" = 'org_initiale';
ALTER TABLE "Invoice" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "OutboundMessage" ADD COLUMN "organizationId" TEXT;
UPDATE "OutboundMessage" SET "organizationId" = 'org_initiale';
ALTER TABLE "OutboundMessage" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Quote" ADD COLUMN "organizationId" TEXT;
UPDATE "Quote" SET "organizationId" = 'org_initiale';
ALTER TABLE "Quote" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Report" ADD COLUMN "organizationId" TEXT;
UPDATE "Report" SET "organizationId" = 'org_initiale';
ALTER TABLE "Report" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Site" ADD COLUMN "organizationId" TEXT;
UPDATE "Site" SET "organizationId" = 'org_initiale';
ALTER TABLE "Site" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Technician" ADD COLUMN "organizationId" TEXT;
UPDATE "Technician" SET "organizationId" = 'org_initiale';
ALTER TABLE "Technician" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "User" ADD COLUMN "organizationId" TEXT;
UPDATE "User" SET "organizationId" = 'org_initiale';
ALTER TABLE "User" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

ALTER TABLE "Counter" ADD COLUMN "organizationId" TEXT;
UPDATE "Counter" SET "organizationId" = 'org_initiale';
ALTER TABLE "Counter" ALTER COLUMN "organizationId" SET NOT NULL,
  ALTER COLUMN "organizationId" SET DEFAULT current_setting('app.organization_id'::text, true);

-- Compteurs : un jeu par entreprise
ALTER TABLE "Counter" DROP CONSTRAINT "Counter_pkey",
ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("organizationId", "key");

-- DropIndex
DROP INDEX "CatalogItem_code_key";

-- DropIndex
DROP INDEX "Contract_reference_key";

-- DropIndex
DROP INDEX "InboundRequest_externalId_key";

-- DropIndex
DROP INDEX "Intervention_number_key";

-- DropIndex
DROP INDEX "Invoice_creditNoteNumber_key";

-- DropIndex
DROP INDEX "Invoice_number_key";

-- DropIndex
DROP INDEX "Quote_number_key";

-- DropIndex
DROP INDEX "Technician_email_key";

-- CreateIndex
CREATE INDEX "Activity_organizationId_idx" ON "Activity"("organizationId");

-- CreateIndex
CREATE INDEX "Attachment_organizationId_idx" ON "Attachment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_organizationId_code_key" ON "CatalogItem"("organizationId", "code");

-- CreateIndex
CREATE INDEX "Client_organizationId_idx" ON "Client"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_organizationId_reference_key" ON "Contract"("organizationId", "reference");

-- CreateIndex
CREATE INDEX "Equipment_organizationId_idx" ON "Equipment"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "InboundRequest_organizationId_externalId_key" ON "InboundRequest"("organizationId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Intervention_organizationId_number_key" ON "Intervention"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_number_key" ON "Invoice"("organizationId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_organizationId_creditNoteNumber_key" ON "Invoice"("organizationId", "creditNoteNumber");

-- CreateIndex
CREATE INDEX "OutboundMessage_organizationId_idx" ON "OutboundMessage"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_organizationId_number_key" ON "Quote"("organizationId", "number");

-- CreateIndex
CREATE INDEX "Report_organizationId_idx" ON "Report"("organizationId");

-- CreateIndex
CREATE INDEX "Site_organizationId_idx" ON "Site"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Technician_organizationId_email_key" ON "Technician"("organizationId", "email");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Technician" ADD CONSTRAINT "Technician_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundRequest" ADD CONSTRAINT "InboundRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Counter" ADD CONSTRAINT "Counter_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
