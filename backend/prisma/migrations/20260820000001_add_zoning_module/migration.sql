-- CreateEnum
CREATE TYPE "ZoningStatut" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('BAIT_STATION', 'MECHANICAL_TRAP', 'GLUE_TRAP', 'FLYING_INSECT_KILLER');

-- CreateEnum
CREATE TYPE "DeviceStatut" AS ENUM ('ACTIVE', 'REMOVED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "FieldInterventionType" AS ENUM ('OPERATION', 'VISITE');

-- CreateEnum
CREATE TYPE "FieldInterventionStatut" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'VALIDATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FieldReportStatut" AS ENUM ('DRAFT', 'FINAL');

-- CreateTable ZoningVersion
CREATE TABLE "ZoningVersion" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" "ZoningStatut" NOT NULL DEFAULT 'DRAFT',
    "dateActivation" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZoningVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable ZoningPlan
CREATE TABLE "ZoningPlan" (
    "id" TEXT NOT NULL,
    "zoningVersionId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ZoningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable Zone
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "zoningVersionId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "etage" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable MonitoringDevice
CREATE TABLE "MonitoringDevice" (
    "id" TEXT NOT NULL,
    "zoningVersionId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "displayNumber" TEXT NOT NULL,
    "nom" TEXT,
    "statut" "DeviceStatut" NOT NULL DEFAULT 'ACTIVE',
    "dateInstallation" TIMESTAMP(3),
    "dateRetrait" TIMESTAMP(3),
    "planId" TEXT,
    "planX" DOUBLE PRECISION,
    "planY" DOUBLE PRECISION,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MonitoringDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable ControlStatus
CREATE TABLE "ControlStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable FieldIntervention
CREATE TABLE "FieldIntervention" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "zoningVersionId" TEXT NOT NULL,
    "type" "FieldInterventionType" NOT NULL,
    "statut" "FieldInterventionStatut" NOT NULL DEFAULT 'DRAFT',
    "dateIntervention" TIMESTAMP(3) NOT NULL,
    "heureDebut" TEXT,
    "heureFin" TEXT,
    "commentaire" TEXT,
    "draftSavedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FieldIntervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable FIApplicateur
CREATE TABLE "FIApplicateur" (
    "id" TEXT NOT NULL,
    "fieldInterventionId" TEXT NOT NULL,
    "employeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FIApplicateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable DeviceControl
CREATE TABLE "DeviceControl" (
    "id" TEXT NOT NULL,
    "fieldInterventionId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "statusCode" TEXT,
    "observation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeviceControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable InsectCount
CREATE TABLE "InsectCount" (
    "id" TEXT NOT NULL,
    "deviceControlId" TEXT NOT NULL,
    "espece" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsectCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable ControlPhoto
CREATE TABLE "ControlPhoto" (
    "id" TEXT NOT NULL,
    "deviceControlId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ControlPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable FIProduct
CREATE TABLE "FIProduct" (
    "id" TEXT NOT NULL,
    "fieldInterventionId" TEXT NOT NULL,
    "produitId" TEXT,
    "nom" TEXT NOT NULL,
    "lot" TEXT,
    "dateFabrication" TIMESTAMP(3),
    "datePeremption" TIMESTAMP(3),
    "quantite" DOUBLE PRECISION,
    "unite" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FIProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable FieldInterventionDocument
CREATE TABLE "FieldInterventionDocument" (
    "id" TEXT NOT NULL,
    "fieldInterventionId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldInterventionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable FieldReport
CREATE TABLE "FieldReport" (
    "id" TEXT NOT NULL,
    "fieldInterventionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "statut" "FieldReportStatut" NOT NULL DEFAULT 'DRAFT',
    "titre" TEXT,
    "conclusion" TEXT,
    "recommandations" TEXT,
    "pdfPath" TEXT,
    "xlsxPath" TEXT,
    "generatedById" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable SiteDocument
CREATE TABLE "SiteDocument" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER,
    "mimeType" TEXT,
    "date" TIMESTAMP(3),
    "annee" INTEGER,
    "commentaire" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable ImportLog
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "siteId" TEXT,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "rapport" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoningVersion_siteId_version_key" ON "ZoningVersion"("siteId", "version");
CREATE INDEX "ZoningVersion_siteId_idx" ON "ZoningVersion"("siteId");
CREATE INDEX "ZoningVersion_statut_idx" ON "ZoningVersion"("statut");
CREATE INDEX "ZoningPlan_zoningVersionId_idx" ON "ZoningPlan"("zoningVersionId");
CREATE INDEX "Zone_zoningVersionId_idx" ON "Zone"("zoningVersionId");
CREATE UNIQUE INDEX "MonitoringDevice_zoningVersionId_type_displayNumber_key" ON "MonitoringDevice"("zoningVersionId", "type", "displayNumber");
CREATE INDEX "MonitoringDevice_zoningVersionId_idx" ON "MonitoringDevice"("zoningVersionId");
CREATE INDEX "MonitoringDevice_zoneId_idx" ON "MonitoringDevice"("zoneId");
CREATE INDEX "MonitoringDevice_type_idx" ON "MonitoringDevice"("type");
CREATE UNIQUE INDEX "ControlStatus_code_key" ON "ControlStatus"("code");
CREATE INDEX "FieldIntervention_siteId_idx" ON "FieldIntervention"("siteId");
CREATE INDEX "FieldIntervention_clientId_idx" ON "FieldIntervention"("clientId");
CREATE INDEX "FieldIntervention_zoningVersionId_idx" ON "FieldIntervention"("zoningVersionId");
CREATE INDEX "FieldIntervention_statut_idx" ON "FieldIntervention"("statut");
CREATE INDEX "FieldIntervention_dateIntervention_idx" ON "FieldIntervention"("dateIntervention");
CREATE UNIQUE INDEX "FIApplicateur_fieldInterventionId_employeId_key" ON "FIApplicateur"("fieldInterventionId", "employeId");
CREATE INDEX "FIApplicateur_fieldInterventionId_idx" ON "FIApplicateur"("fieldInterventionId");
CREATE UNIQUE INDEX "DeviceControl_fieldInterventionId_deviceId_key" ON "DeviceControl"("fieldInterventionId", "deviceId");
CREATE INDEX "DeviceControl_fieldInterventionId_idx" ON "DeviceControl"("fieldInterventionId");
CREATE INDEX "DeviceControl_deviceId_idx" ON "DeviceControl"("deviceId");
CREATE UNIQUE INDEX "InsectCount_deviceControlId_espece_key" ON "InsectCount"("deviceControlId", "espece");
CREATE INDEX "InsectCount_deviceControlId_idx" ON "InsectCount"("deviceControlId");
CREATE INDEX "ControlPhoto_deviceControlId_idx" ON "ControlPhoto"("deviceControlId");
CREATE INDEX "FIProduct_fieldInterventionId_idx" ON "FIProduct"("fieldInterventionId");
CREATE INDEX "FieldInterventionDocument_fieldInterventionId_idx" ON "FieldInterventionDocument"("fieldInterventionId");
CREATE UNIQUE INDEX "FieldReport_fieldInterventionId_version_key" ON "FieldReport"("fieldInterventionId", "version");
CREATE INDEX "FieldReport_fieldInterventionId_idx" ON "FieldReport"("fieldInterventionId");
CREATE INDEX "SiteDocument_siteId_idx" ON "SiteDocument"("siteId");
CREATE INDEX "ImportLog_siteId_idx" ON "ImportLog"("siteId");

-- AddForeignKey
ALTER TABLE "ZoningVersion" ADD CONSTRAINT "ZoningVersion_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ZoningVersion" ADD CONSTRAINT "ZoningVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ZoningPlan" ADD CONSTRAINT "ZoningPlan_zoningVersionId_fkey" FOREIGN KEY ("zoningVersionId") REFERENCES "ZoningVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_zoningVersionId_fkey" FOREIGN KEY ("zoningVersionId") REFERENCES "ZoningVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringDevice" ADD CONSTRAINT "MonitoringDevice_zoningVersionId_fkey" FOREIGN KEY ("zoningVersionId") REFERENCES "ZoningVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MonitoringDevice" ADD CONSTRAINT "MonitoringDevice_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_zoningVersionId_fkey" FOREIGN KEY ("zoningVersionId") REFERENCES "ZoningVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldIntervention" ADD CONSTRAINT "FieldIntervention_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FIApplicateur" ADD CONSTRAINT "FIApplicateur_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FIApplicateur" ADD CONSTRAINT "FIApplicateur_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "Employe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeviceControl" ADD CONSTRAINT "DeviceControl_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeviceControl" ADD CONSTRAINT "DeviceControl_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "MonitoringDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InsectCount" ADD CONSTRAINT "InsectCount_deviceControlId_fkey" FOREIGN KEY ("deviceControlId") REFERENCES "DeviceControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ControlPhoto" ADD CONSTRAINT "ControlPhoto_deviceControlId_fkey" FOREIGN KEY ("deviceControlId") REFERENCES "DeviceControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FIProduct" ADD CONSTRAINT "FIProduct_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FIProduct" ADD CONSTRAINT "FIProduct_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "ProduitService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FieldInterventionDocument" ADD CONSTRAINT "FieldInterventionDocument_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_fieldInterventionId_fkey" FOREIGN KEY ("fieldInterventionId") REFERENCES "FieldIntervention"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FieldReport" ADD CONSTRAINT "FieldReport_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteDocument" ADD CONSTRAINT "SiteDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportLog" ADD CONSTRAINT "ImportLog_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed ControlStatus (référentiel de base)
INSERT INTO "ControlStatus" ("id", "code", "label", "description", "color", "ordre") VALUES
  (gen_random_uuid(), 'RAS',  'Rien à signaler',             NULL,                           '#22c55e', 0),
  (gen_random_uuid(), 'EBR',  'Ébréché / Abîmé',             'Dispositif endommagé',         '#f97316', 1),
  (gen_random_uuid(), 'CON',  'Consommé',                    'Appât consommé totalement',    '#3b82f6', 2),
  (gen_random_uuid(), 'NT',   'Non trouvé',                  'Dispositif introuvable',       '#94a3b8', 3),
  (gen_random_uuid(), 'CAS',  'Cassé',                       'Dispositif cassé',             '#ef4444', 4),
  (gen_random_uuid(), 'RT',   'Remplacé',                    'Dispositif remplacé',          '#a855f7', 5),
  (gen_random_uuid(), 'INAC', 'Inactif',                     'Dispositif désactivé',         '#64748b', 6),
  (gen_random_uuid(), 'SOU',  'Souillé',                     'Dispositif souillé',           '#78350f', 7);
