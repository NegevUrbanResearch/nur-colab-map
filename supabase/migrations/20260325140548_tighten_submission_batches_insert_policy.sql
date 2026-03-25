-- Replace INSERT policy on submission_batches: require created_by = auth.uid(), and when
-- geo_features already reference this submission_id, require editor/owner on those projects.
-- Inserts for submission_ids with no features yet (new batch before features) remain allowed.
-- Idempotent: DROP POLICY IF EXISTS then CREATE (safe to re-run in dev resets).

DROP POLICY IF EXISTS "Editors can insert submission batches" ON public.submission_batches;

CREATE POLICY "Editors can insert submission batches"
    ON public.submission_batches
    AS PERMISSIVE
    FOR INSERT
    TO public
    WITH CHECK (
        created_by = auth.uid()
        AND (
            NOT EXISTS (
                SELECT 1
                FROM public.geo_features gf
                WHERE gf.submission_id = submission_batches.submission_id
            )
            OR EXISTS (
                SELECT 1
                FROM public.geo_features gf
                JOIN public.project_members pm ON pm.project_id = gf.project_id
                WHERE gf.submission_id = submission_batches.submission_id
                  AND pm.user_id = auth.uid()
                  AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
            )
        )
    );
