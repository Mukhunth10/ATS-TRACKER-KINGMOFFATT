/*
  Warnings:

  - Made the column `applyToken` on table `Job` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "seniority" TEXT NOT NULL,
    "mustHave" TEXT NOT NULL DEFAULT '[]',
    "niceToHave" TEXT NOT NULL DEFAULT '[]',
    "customMustHave" TEXT NOT NULL DEFAULT '[]',
    "customNiceToHave" TEXT NOT NULL DEFAULT '[]',
    "minYears" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "description" TEXT NOT NULL DEFAULT '',
    "applyToken" TEXT NOT NULL,
    "applyOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Job" ("applyOpen", "applyToken", "createdAt", "customMustHave", "customNiceToHave", "description", "id", "location", "minYears", "mustHave", "niceToHave", "seniority", "status", "title", "track") SELECT "applyOpen", "applyToken", "createdAt", "customMustHave", "customNiceToHave", "description", "id", "location", "minYears", "mustHave", "niceToHave", "seniority", "status", "title", "track" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE UNIQUE INDEX "Job_applyToken_key" ON "Job"("applyToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
