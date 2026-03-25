-- Applied environments: align DELETE policy with FK RESTRICT (delete only when no geo_features).
-- Block updates to submission_batches.created_by (matches baseline migration for fresh installs).

DROP POLICY IF EXISTS "Editors can delete submission batches" ON public.submission_batches;

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
