-- CreateEnum
CREATE TYPE "CommunityReviewStatus" AS ENUM ('PENDING_REVIEW', 'AUTO_VERIFIED', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "SourceKind" ADD VALUE IF NOT EXISTS 'COMMUNITY';

-- CreateTable
CREATE TABLE "CommunityFormulaSubmission" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "submittedBy" TEXT,
    "sourceUrl" TEXT,
    "imageUrl" TEXT,
    "rawOcrText" TEXT,
    "extractedIngredientsText" TEXT,
    "ingredientList" JSONB NOT NULL,
    "extractionMethod" TEXT,
    "verificationStatus" "AttemptStatus" NOT NULL,
    "reviewStatus" "CommunityReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNotes" TEXT,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "verifiedFormulaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityFormulaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommunityFormulaSubmission_fingerprint_createdAt_idx" ON "CommunityFormulaSubmission"("fingerprint", "createdAt");

-- AddForeignKey
ALTER TABLE "CommunityFormulaSubmission" ADD CONSTRAINT "CommunityFormulaSubmission_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunityFormulaSubmission" ADD CONSTRAINT "CommunityFormulaSubmission_verifiedFormulaId_fkey" FOREIGN KEY ("verifiedFormulaId") REFERENCES "VerifiedFormula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
