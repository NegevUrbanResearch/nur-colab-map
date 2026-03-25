-- Strengthen submission_batches INSERT RLS:
--   1) created_by = auth.uid()
--   2) user is owner/editor on at least one project (global gate)
--   3) no geo_features for this submission_id yet OR user is owner/editor on a project tied to existing features
-- Idempotent: DROP POLICY IF EXISTS then CREATE.

DROP POLICY IF EXISTS "Editors can insert submission batches" ON public.submission_batches;

CREATE POLICY "Editors can insert submission batches"
    ON public.submission_batches
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.project_members pm_gate
            WHERE pm_gate.user_id = auth.uid()
              AND pm_gate.role = ANY (ARRAY['owner'::text, 'editor'::text])
        )
        AND (
            NOT EXISTS (
                SELECT 1
                FROM public.geo_features gf
                WHERE gf.submission_id = submission_batches.submission_id
            )
            OR EXISTS (
                SELECT 1
                FROM public.geo_features gf
                JOIN public.project_members pm_feat ON pm_feat.project_id = gf.project_id
                WHERE gf.submission_id = submission_batches.submission_id
                  AND pm_feat.user_id = auth.uid()
                  AND pm_feat.role = ANY (ARRAY['owner'::text, 'editor'::text])
            )
        )
    );
