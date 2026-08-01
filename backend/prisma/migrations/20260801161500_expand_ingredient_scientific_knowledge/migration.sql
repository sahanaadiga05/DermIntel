ALTER TABLE "Ingredient"
ADD COLUMN "commonNames" JSONB,
ADD COLUMN "casNumber" TEXT,
ADD COLUMN "category" TEXT,
ADD COLUMN "primaryPurpose" TEXT,
ADD COLUMN "howItWorks" TEXT,
ADD COLUMN "bestSkinTypes" JSONB,
ADD COLUMN "helpsConcerns" JSONB;
