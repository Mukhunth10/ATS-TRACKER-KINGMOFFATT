-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "provenCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Application_jobId_ruleScore_idx" ON "Application"("jobId", "ruleScore");

-- CreateIndex
CREATE INDEX "Application_jobId_aiScore_idx" ON "Application"("jobId", "aiScore");

-- CreateIndex
CREATE INDEX "Application_jobId_provenCount_idx" ON "Application"("jobId", "provenCount");

