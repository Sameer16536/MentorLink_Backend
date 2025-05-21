/*
  Warnings:

  - Added the required column `platformFee` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "method" TEXT,
ADD COLUMN     "platformFee" INTEGER NOT NULL,
ADD COLUMN     "stripeIntentId" TEXT,
ADD COLUMN     "stripeSessionId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';
