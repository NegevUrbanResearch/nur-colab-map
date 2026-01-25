-- Add description column to geo_features table
ALTER TABLE "public"."geo_features" 
ADD COLUMN IF NOT EXISTS "description" text;
