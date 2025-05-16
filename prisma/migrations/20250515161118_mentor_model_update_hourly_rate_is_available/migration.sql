-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "hourlyRate" INTEGER,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT false;
