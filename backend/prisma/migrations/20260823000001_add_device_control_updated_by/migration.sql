ALTER TABLE "DeviceControl" ADD COLUMN "updatedById" TEXT;
ALTER TABLE "DeviceControl" ADD CONSTRAINT "DeviceControl_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "DeviceControl_updatedById_idx" ON "DeviceControl"("updatedById");
