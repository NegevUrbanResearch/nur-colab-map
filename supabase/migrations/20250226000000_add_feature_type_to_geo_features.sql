ALTER TABLE "public"."geo_features"
ADD COLUMN IF NOT EXISTS "feature_type" text;
