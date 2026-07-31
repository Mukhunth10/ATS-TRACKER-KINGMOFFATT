-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assessment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Technical assessment',
    "instructions" TEXT NOT NULL DEFAULT '',
    "testUrl" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "outputUrl" TEXT NOT NULL DEFAULT '',
    "candidateNote" TEXT NOT NULL DEFAULT '',
    "consentScreen" BOOLEAN NOT NULL DEFAULT false,
    "consentCamera" BOOLEAN NOT NULL DEFAULT false,
    "consentNoticeVersion" TEXT NOT NULL DEFAULT '',
    "consentAt" DATETIME,
    "attentionAwaySec" INTEGER NOT NULL DEFAULT 0,
    "attentionEvents" INTEGER NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "durationMin" INTEGER,
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Assessment" ("applicationId", "candidateNote", "consentAt", "consentCamera", "consentNoticeVersion", "consentScreen", "createdAt", "durationMin", "id", "instructions", "outputUrl", "qualityScore", "reviewNotes", "reviewedAt", "sentAt", "status", "submittedAt", "testUrl", "title", "token", "videoUrl") SELECT "applicationId", "candidateNote", "consentAt", "consentCamera", "consentNoticeVersion", "consentScreen", "createdAt", "durationMin", "id", "instructions", "outputUrl", "qualityScore", "reviewNotes", "reviewedAt", "sentAt", "status", "submittedAt", "testUrl", "title", "token", "videoUrl" FROM "Assessment";
DROP TABLE "Assessment";
ALTER TABLE "new_Assessment" RENAME TO "Assessment";
CREATE UNIQUE INDEX "Assessment_applicationId_key" ON "Assessment"("applicationId");
CREATE UNIQUE INDEX "Assessment_token_key" ON "Assessment"("token");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
