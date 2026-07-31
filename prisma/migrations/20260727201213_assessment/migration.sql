-- CreateTable
CREATE TABLE "Assessment" (
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
    "qualityScore" INTEGER,
    "durationMin" INTEGER,
    "reviewNotes" TEXT NOT NULL DEFAULT '',
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_applicationId_key" ON "Assessment"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_token_key" ON "Assessment"("token");
