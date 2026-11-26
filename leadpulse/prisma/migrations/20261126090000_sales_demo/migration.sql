CREATE TABLE "sales_slots" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    CONSTRAINT "sales_slots_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "sales_runs" (
    "id" UUID NOT NULL,
    "account" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "slotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sales_runs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sales_runs_slotId_key" ON "sales_runs"("slotId");
CREATE INDEX "sales_runs_account_createdAt_idx" ON "sales_runs"("account", "createdAt");
ALTER TABLE "sales_runs" ADD CONSTRAINT "sales_runs_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "sales_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
