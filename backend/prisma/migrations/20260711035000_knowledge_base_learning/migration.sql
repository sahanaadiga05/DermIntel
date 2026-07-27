-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('RETAILER', 'OFFICIAL_BRAND', 'STRUCTURED_METADATA', 'TRUSTED_DATABASE', 'PHARMACY', 'SEARCH_ENGINE', 'AI', 'KNOWLEDGE_BASE');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('STARTED', 'COMPLETED', 'FAILED', 'SKIPPED', 'VERIFIED');

-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Ingredient" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "canonicalName" TEXT;
ALTER TABLE "Product" ADD COLUMN "variant" TEXT;
ALTER TABLE "Product" ADD COLUMN "size" TEXT;
ALTER TABLE "Product" ADD COLUMN "fingerprint" TEXT;
ALTER TABLE "Product" ADD COLUMN "sourceDomain" TEXT;
ALTER TABLE "Product" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Product" ALTER COLUMN "ingredientsText" SET DEFAULT '';

-- CreateTable
CREATE TABLE "IngredientAlias" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "label" TEXT NOT NULL,
    "domain" TEXT,
    "url" TEXT NOT NULL,
    "productId" TEXT,
    "storeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "matchedCount" INTEGER NOT NULL,
    "unknownCount" INTEGER NOT NULL,
    "aliasMatchedCount" INTEGER NOT NULL,
    "ingredientCount" INTEGER NOT NULL,
    "rule" TEXT,
    "reason" TEXT,
    "sourceId" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerifiedFormula" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "ingredientsText" TEXT NOT NULL,
    "ingredientList" JSONB NOT NULL,
    "ingredientCount" INTEGER NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "sourceId" TEXT,
    "verificationId" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifiedFormula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAttempt" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "verifiedFormulaId" TEXT,
    "sourceId" TEXT,
    "storeId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "url" TEXT,
    "sourceWebsite" TEXT,
    "extractionMethod" TEXT,
    "status" "AttemptStatus" NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientAlias_normalizedAlias_key" ON "IngredientAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "Product_fingerprint_key" ON "Product"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "Store_domain_key" ON "Store"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "VerifiedFormula_verificationId_key" ON "VerifiedFormula"("verificationId");

-- CreateIndex
CREATE INDEX "VerifiedFormula_fingerprint_idx" ON "VerifiedFormula"("fingerprint");

-- CreateIndex
CREATE INDEX "VerifiedFormula_productId_confidenceScore_idx" ON "VerifiedFormula"("productId", "confidenceScore");

-- CreateIndex
CREATE INDEX "SearchAttempt_fingerprint_createdAt_idx" ON "SearchAttempt"("fingerprint", "createdAt");

-- AddForeignKey
ALTER TABLE "IngredientAlias" ADD CONSTRAINT "IngredientAlias_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Source" ADD CONSTRAINT "Source_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifiedFormula" ADD CONSTRAINT "VerifiedFormula_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifiedFormula" ADD CONSTRAINT "VerifiedFormula_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VerifiedFormula" ADD CONSTRAINT "VerifiedFormula_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAttempt" ADD CONSTRAINT "SearchAttempt_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SearchAttempt" ADD CONSTRAINT "SearchAttempt_verifiedFormulaId_fkey" FOREIGN KEY ("verifiedFormulaId") REFERENCES "VerifiedFormula"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SearchAttempt" ADD CONSTRAINT "SearchAttempt_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SearchAttempt" ADD CONSTRAINT "SearchAttempt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
