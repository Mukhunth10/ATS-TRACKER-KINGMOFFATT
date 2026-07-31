-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'applied',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "ruleScore" INTEGER NOT NULL DEFAULT 0,
    "ruleDetail" TEXT NOT NULL DEFAULT '{}',
    "aiScore" INTEGER,
    "aiSummary" TEXT,
    "aiDetail" TEXT,
    "aiScoredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Application" ("aiDetail", "aiScore", "aiScoredAt", "aiSummary", "candidateId", "createdAt", "id", "jobId", "ruleDetail", "ruleScore", "stage", "updatedAt") SELECT "aiDetail", "aiScore", "aiScoredAt", "aiSummary", "candidateId", "createdAt", "id", "jobId", "ruleDetail", "ruleScore", "stage", "updatedAt" FROM "Application";
DROP TABLE "Application";
ALTER TABLE "new_Application" RENAME TO "Application";
CREATE INDEX "Application_jobId_stage_idx" ON "Application"("jobId", "stage");
CREATE UNIQUE INDEX "Application_jobId_candidateId_key" ON "Application"("jobId", "candidateId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
