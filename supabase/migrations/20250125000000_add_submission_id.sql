-- Add submission_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'geo_features' 
        AND column_name = 'submission_id'
    ) THEN
        ALTER TABLE "public"."geo_features" ADD COLUMN "submission_id" uuid;
    END IF;
END $$;
