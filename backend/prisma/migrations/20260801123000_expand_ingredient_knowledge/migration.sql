ALTER TABLE "Ingredient"
ADD COLUMN "displayPurpose" TEXT,
ADD COLUMN "functions" JSONB,
ADD COLUMN "helps" JSONB,
ADD COLUMN "avoidFor" JSONB,
ADD COLUMN "tags" JSONB,
ADD COLUMN "riskFlags" JSONB,
ADD COLUMN "evidenceLevel" TEXT,
ADD COLUMN "references" JSONB;
