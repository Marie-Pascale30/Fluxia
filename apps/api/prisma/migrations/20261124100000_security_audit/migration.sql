-- Audit de sécurité : export préalable à la suppression, messages de sécurité non conservés

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "dataExportedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OutboundMessage" ADD COLUMN "sensitive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "template" TEXT;

-- Liens de réinitialisation déjà stockés en clair : contenu effacé, messages marqués comme sensibles
UPDATE "OutboundMessage"
SET "body" = 'Lien de réinitialisation envoyé (contenu non conservé).', "sensitive" = true
WHERE "entityType" = 'USER' AND "body" LIKE '%/mot-de-passe/%';
