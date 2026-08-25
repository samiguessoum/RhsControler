-- Enum pour les catégories de contrôle simple
CREATE TYPE "FICheckCategory" AS ENUM ('REGARDS', 'GOLIATH', 'AUTRE');

-- Table FISimpleCheck (Regards/Avaloirs, Goliath Gel, Autre)
CREATE TABLE "FISimpleCheck" (
  "id" TEXT NOT NULL,
  "fieldInterventionId" TEXT NOT NULL,
  "category" "FICheckCategory" NOT NULL,
  "subType" TEXT NOT NULL DEFAULT '',
  "statut" TEXT,
  "commentaire" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FISimpleCheck_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FISimpleCheck"
  ADD CONSTRAINT "FISimpleCheck_fieldInterventionId_fkey"
  FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FISimpleCheck"
  ADD CONSTRAINT "FISimpleCheck_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "FISimpleCheck_fieldInterventionId_category_subType_key"
  ON "FISimpleCheck"("fieldInterventionId", "category", "subType");

CREATE INDEX "FISimpleCheck_fieldInterventionId_idx"
  ON "FISimpleCheck"("fieldInterventionId");

-- Table DeviceControlAudit (historique des modifications de contrôle)
CREATE TABLE "DeviceControlAudit" (
  "id" TEXT NOT NULL,
  "deviceControlId" TEXT NOT NULL,
  "fieldInterventionId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "oldStatusCode" TEXT,
  "newStatusCode" TEXT,
  "oldObservation" TEXT,
  "newObservation" TEXT,
  "changedById" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeviceControlAudit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeviceControlAudit"
  ADD CONSTRAINT "DeviceControlAudit_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DeviceControlAudit_deviceControlId_idx" ON "DeviceControlAudit"("deviceControlId");
CREATE INDEX "DeviceControlAudit_fieldInterventionId_idx" ON "DeviceControlAudit"("fieldInterventionId");
CREATE INDEX "DeviceControlAudit_changedById_idx" ON "DeviceControlAudit"("changedById");
