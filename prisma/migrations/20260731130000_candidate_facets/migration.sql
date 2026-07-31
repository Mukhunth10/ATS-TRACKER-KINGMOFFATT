-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "bimRole" TEXT,
ADD COLUMN     "degree" TEXT,
ADD COLUMN     "digitalEngineering" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lodMax" INTEGER,
ADD COLUMN     "longestTenureYears" INTEGER,
ADD COLUMN     "regions" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "workAuth" TEXT;

-- CreateIndex
CREATE INDEX "Candidate_workAuth_idx" ON "Candidate"("workAuth");

-- CreateIndex
CREATE INDEX "Candidate_degree_idx" ON "Candidate"("degree");

-- CreateIndex
CREATE INDEX "Candidate_lodMax_idx" ON "Candidate"("lodMax");

-- CreateIndex
CREATE INDEX "Candidate_bimRole_idx" ON "Candidate"("bimRole");

-- CreateIndex
CREATE INDEX "Candidate_longestTenureYears_idx" ON "Candidate"("longestTenureYears");

