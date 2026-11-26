ALTER TABLE "sales_slots" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "sales_runs" ADD COLUMN "tenantId" TEXT;
CREATE INDEX "sales_slots_tenantId_startsAt_idx" ON "sales_slots"("tenantId", "startsAt");
CREATE INDEX "sales_runs_tenantId_createdAt_idx" ON "sales_runs"("tenantId", "createdAt");
