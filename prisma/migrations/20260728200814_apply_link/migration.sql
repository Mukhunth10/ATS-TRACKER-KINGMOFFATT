-- Public Apply link per role, added with a backfill so existing rows get a token.
ALTER TABLE "Job" ADD COLUMN "applyToken" TEXT;
ALTER TABLE "Job" ADD COLUMN "applyOpen" BOOLEAN NOT NULL DEFAULT true;
UPDATE "Job" SET "applyToken" = lower(hex(randomblob(16))) WHERE "applyToken" IS NULL;
CREATE UNIQUE INDEX "Job_applyToken_key" ON "Job"("applyToken");
