-- submission_batches: metadata per submission_id (one row per distinct submission UUID).
-- Backfill created_by: geo_features has no user column. We resolve in order:
--   1) Any project owner (MIN user_id) for a project_id appearing on a feature with that submission_id
--   2) Else any editor (MIN user_id) under the same rule
--   3) Else earliest auth.users row by created_at (legacy/orphan data; requires at least one auth user)

CREATE TABLE IF NOT EXISTS public.submission_batches (
    submission_id uuid PRIMARY KEY,
    submission_name text NOT NULL,
    created_by uuid NOT NULL REFERENCES auth.users (id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.submission_batches ENABLE ROW LEVEL SECURITY;

-- Fail fast before backfill when legacy rows need created_by but no auth users exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.geo_features WHERE submission_id IS NOT NULL LIMIT 1)
       AND NOT EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
        RAISE EXCEPTION 'submission_batches backfill: auth.users is empty but geo_features has non-null submission_id rows; cannot resolve created_by'
            USING ERRCODE = 'check_violation';
    END IF;
END $$;

-- Backfill before FK so existing geo_features.submission_id values remain valid
WITH subs AS (
    SELECT DISTINCT submission_id
    FROM public.geo_features
    WHERE submission_id IS NOT NULL
),
resolved AS (
    SELECT
        s.submission_id,
        'הגשה ללא שם - ' || left(replace(s.submission_id::text, '-', ''), 8) AS submission_name,
        COALESCE(
            (
                SELECT pm.user_id
                FROM public.geo_features gf
                JOIN public.project_members pm ON pm.project_id = gf.project_id
                WHERE gf.submission_id = s.submission_id
                  AND pm.role = 'owner'
                ORDER BY pm.user_id
                LIMIT 1
            ),
            (
                SELECT pm.user_id
                FROM public.geo_features gf
                JOIN public.project_members pm ON pm.project_id = gf.project_id
                WHERE gf.submission_id = s.submission_id
                  AND pm.role = 'editor'
                ORDER BY pm.user_id
                LIMIT 1
            ),
            (
                SELECT u.id
                FROM auth.users u
                ORDER BY u.created_at ASC NULLS LAST
                LIMIT 1
            )
        ) AS created_by
    FROM subs s
)
INSERT INTO public.submission_batches (submission_id, submission_name, created_by, created_at, updated_at)
SELECT submission_id, submission_name, created_by, now(), now()
FROM resolved
ON CONFLICT (submission_id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = 'public.geo_features'::regclass
          AND c.conname = 'geo_features_submission_id_fkey'
          AND c.contype = 'f'
    ) THEN
        ALTER TABLE public.geo_features
            ADD CONSTRAINT geo_features_submission_id_fkey
            FOREIGN KEY (submission_id)
            REFERENCES public.submission_batches (submission_id)
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS geo_features_submission_id_idx
    ON public.geo_features (submission_id);

CREATE INDEX IF NOT EXISTS geo_features_submission_project_idx
    ON public.geo_features (submission_id, project_id);

CREATE INDEX IF NOT EXISTS submission_batches_created_by_updated_at_idx
    ON public.submission_batches (created_by, updated_at DESC);

CREATE OR REPLACE FUNCTION public.submission_batches_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submission_batches_set_updated_at ON public.submission_batches;

CREATE TRIGGER submission_batches_set_updated_at
    BEFORE UPDATE ON public.submission_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.submission_batches_set_updated_at();

CREATE OR REPLACE FUNCTION public.submission_batches_prevent_created_by_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'submission_batches.created_by is immutable (submission_id=%)', OLD.submission_id
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS submission_batches_prevent_created_by_change ON public.submission_batches;

CREATE TRIGGER submission_batches_prevent_created_by_change
    BEFORE UPDATE ON public.submission_batches
    FOR EACH ROW
    EXECUTE FUNCTION public.submission_batches_prevent_created_by_change();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submission_batches'
          AND policyname = 'Members can view submission batches in their projects'
    ) THEN
        CREATE POLICY "Members can view submission batches in their projects"
            ON public.submission_batches
            AS PERMISSIVE
            FOR SELECT
            TO public
            USING (
                created_by = auth.uid()
                OR EXISTS (
                    SELECT 1
                    FROM public.geo_features gf
                    JOIN public.project_members pm ON pm.project_id = gf.project_id
                    WHERE gf.submission_id = submission_batches.submission_id
                      AND pm.user_id = auth.uid()
                )
            );
    END IF;
END $$;

-- INSERT: submission_batches has no project_id; new rows are created before geo_features exist.
-- Aligns with geo_features insert rights: any user who is an owner/editor on at least one project.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submission_batches'
          AND policyname = 'Editors can insert submission batches'
    ) THEN
        CREATE POLICY "Editors can insert submission batches"
            ON public.submission_batches
            AS PERMISSIVE
            FOR INSERT
            TO public
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.project_members pm
                    WHERE pm.user_id = auth.uid()
                      AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submission_batches'
          AND policyname = 'Editors can update submission batches'
    ) THEN
        CREATE POLICY "Editors can update submission batches"
            ON public.submission_batches
            AS PERMISSIVE
            FOR UPDATE
            TO public
            USING (
                EXISTS (
                    SELECT 1
                    FROM public.geo_features gf
                    JOIN public.project_members pm ON pm.project_id = gf.project_id
                    WHERE gf.submission_id = submission_batches.submission_id
                      AND pm.user_id = auth.uid()
                      AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
                )
                OR created_by = auth.uid()
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1
                    FROM public.geo_features gf
                    JOIN public.project_members pm ON pm.project_id = gf.project_id
                    WHERE gf.submission_id = submission_batches.submission_id
                      AND pm.user_id = auth.uid()
                      AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
                )
                OR created_by = auth.uid()
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'submission_batches'
          AND policyname = 'Editors can delete submission batches'
    ) THEN
        CREATE POLICY "Editors can delete submission batches"
            ON public.submission_batches
            AS PERMISSIVE
            FOR DELETE
            TO public
            USING (
                NOT EXISTS (
                    SELECT 1
                    FROM public.geo_features gf
                    WHERE gf.submission_id = submission_batches.submission_id
                )
                AND created_by = auth.uid()
                AND EXISTS (
                    SELECT 1
                    FROM public.project_members pm
                    WHERE pm.user_id = auth.uid()
                      AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
                )
            );
    END IF;
END $$;
