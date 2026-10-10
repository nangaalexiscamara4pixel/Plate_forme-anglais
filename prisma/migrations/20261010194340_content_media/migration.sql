-- AlterEnum
ALTER TYPE "MediaPurpose" ADD VALUE 'LESSON_VIDEO';

-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN     "uploadedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "mediaFileId" TEXT;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
