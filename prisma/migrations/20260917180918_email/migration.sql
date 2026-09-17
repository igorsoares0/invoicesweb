-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('INVOICE', 'ESTIMATE', 'REMINDER');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EstimateEventType" ADD VALUE 'EMAIL_SENT';
ALTER TYPE "EstimateEventType" ADD VALUE 'EMAIL_FAILED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "InvoiceEventType" ADD VALUE 'EMAIL_SENT';
ALTER TYPE "InvoiceEventType" ADD VALUE 'EMAIL_FAILED';

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "estimateId" TEXT,
    "type" "EmailType" NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'QUEUED',
    "recipient" TEXT NOT NULL,
    "recipients" TEXT[],
    "subject" TEXT NOT NULL,
    "attachedPdf" BOOLEAN NOT NULL DEFAULT false,
    "copyToSelf" BOOLEAN NOT NULL DEFAULT false,
    "providerId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_businessId_createdAt_idx" ON "EmailLog"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_invoiceId_createdAt_idx" ON "EmailLog"("invoiceId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_estimateId_createdAt_idx" ON "EmailLog"("estimateId", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "Estimate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
