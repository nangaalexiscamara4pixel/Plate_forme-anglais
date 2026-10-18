-- AlterEnum
ALTER TYPE "BlockKind" ADD VALUE 'DOCUMENT';

-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'SUBMISSION_FILE';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "attachmentFileId" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "fileId" TEXT;

-- CreateTable
CREATE TABLE "AssignmentMaterial" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssignmentMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentMaterial_assignmentId_mediaFileId_key" ON "AssignmentMaterial"("assignmentId", "mediaFileId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_attachmentFileId_fkey" FOREIGN KEY ("attachmentFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentMaterial" ADD CONSTRAINT "AssignmentMaterial_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentMaterial" ADD CONSTRAINT "AssignmentMaterial_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
