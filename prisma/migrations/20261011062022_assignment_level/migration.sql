-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "levelId" TEXT;

-- CreateIndex
CREATE INDEX "Assignment_levelId_status_idx" ON "Assignment"("levelId", "status");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;
