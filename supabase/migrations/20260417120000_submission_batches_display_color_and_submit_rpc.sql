-- submission_batches.display_color: canonical #RRGGBB for map/Cityscope symbology

ALTER TABLE public.submission_batches
    ADD COLUMN IF NOT EXISTS display_color text;

UPDATE public.submission_batches sb
SET display_color = pal.hex
FROM (
    SELECT
        s.submission_id,
        (
            ARRAY[
                '#C1121F',
                '#F48C06',
                '#FFBA08',
                '#136F63',
                '#3A86FF',
                '#8338EC',
                '#FF006E',
                '#38B000',
                '#0077B6',
                '#FB5607',
                '#3EC300',
                '#7209B7',
                '#00B4D8',
                '#E85D04',
                '#9D4EDD',
                '#2D6A4F'
            ]
        )[
            1 + (
                (ROW_NUMBER() OVER (ORDER BY s.created_at ASC, s.submission_id) - 1)
                % 16
            )
        ] AS hex
    FROM public.submission_batches s
) pal
WHERE sb.submission_id = pal.submission_id
  AND (sb.display_color IS NULL OR btrim(sb.display_color) = '');

ALTER TABLE public.submission_batches
    ALTER COLUMN display_color SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'submission_batches'
          AND c.conname = 'submission_batches_display_color_format_chk'
    ) THEN
        ALTER TABLE public.submission_batches
            ADD CONSTRAINT submission_batches_display_color_format_chk
            CHECK (
                display_color ~ '^#[0-9A-F]{6}$'
                AND display_color = ANY (
                    ARRAY[
                        '#C1121F',
                        '#F48C06',
                        '#FFBA08',
                        '#136F63',
                        '#3A86FF',
                        '#8338EC',
                        '#FF006E',
                        '#38B000',
                        '#0077B6',
                        '#FB5607',
                        '#3EC300',
                        '#7209B7',
                        '#00B4D8',
                        '#E85D04',
                        '#9D4EDD',
                        '#2D6A4F'
                    ]::text[]
                )
            );
    END IF;
END $$;

-- Replace RPC so new inserts always populate display_color (same migration = no broken window)

DROP FUNCTION IF EXISTS public.submit_unified_submission_write(text, uuid, text, uuid, uuid, jsonb);

CREATE OR REPLACE FUNCTION public.submit_unified_submission_write(
    p_mode text,
    p_submission_id uuid,
    p_submission_name text,
    p_pink_project_id uuid,
    p_memorial_project_id uuid,
    p_feature_rows jsonb,
    p_submission_display_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    uid uuid := auth.uid();
    allowed_projects uuid[] := ARRAY[]::uuid[];
    batch_created_by uuid;
    v_trim_name text;
    elem jsonb;
    v_project_id uuid;
    v_row_name text;
    v_desc text;
    v_lng double precision;
    v_lat double precision;
    v_feature_type text;
    palette text[] := ARRAY[
        '#C1121F',
        '#F48C06',
        '#FFBA08',
        '#136F63',
        '#3A86FF',
        '#8338EC',
        '#FF006E',
        '#38B000',
        '#0077B6',
        '#FB5607',
        '#3EC300',
        '#7209B7',
        '#00B4D8',
        '#E85D04',
        '#9D4EDD',
        '#2D6A4F'
    ];
    v_raw text := NULLIF(btrim(COALESCE(p_submission_display_color, '')), '');
    v_norm text := NULL;
    v_color text;
    i int;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not authenticated'
            USING ERRCODE = '28000';
    END IF;

    IF p_mode IS NULL OR p_mode NOT IN ('new', 'overwrite') THEN
        RAISE EXCEPTION 'invalid mode'
            USING ERRCODE = '22023';
    END IF;

    IF p_feature_rows IS NULL OR jsonb_typeof(p_feature_rows) <> 'array' THEN
        RAISE EXCEPTION 'p_feature_rows must be a json array'
            USING ERRCODE = '22023';
    END IF;

    IF p_pink_project_id IS NOT NULL THEN
        allowed_projects := array_append(allowed_projects, p_pink_project_id);
    END IF;
    IF p_memorial_project_id IS NOT NULL THEN
        allowed_projects := array_append(allowed_projects, p_memorial_project_id);
    END IF;

    IF cardinality(allowed_projects) = 0 THEN
        RAISE EXCEPTION 'at least one workspace project id is required'
            USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(allowed_projects) AS workspace_project (project_id)
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.project_members pm
            WHERE pm.project_id = workspace_project.project_id
              AND pm.user_id = uid
              AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
        )
    ) THEN
        RAISE EXCEPTION 'must be owner or editor on each workspace project'
            USING ERRCODE = '42501';
    END IF;

    v_trim_name := btrim(COALESCE(p_submission_name, ''));
    IF v_trim_name = '' THEN
        RAISE EXCEPTION 'submission_name is required'
            USING ERRCODE = '22023';
    END IF;

    IF v_raw IS NOT NULL THEN
        v_norm := upper(v_raw);
        IF v_norm !~ '^#[0-9A-F]{6}$' OR NOT (v_norm = ANY (palette)) THEN
            RAISE EXCEPTION 'invalid submission display color'
                USING ERRCODE = '22023';
        END IF;
    END IF;

    IF p_mode = 'new' THEN
        IF EXISTS (SELECT 1 FROM public.submission_batches WHERE submission_id = p_submission_id) THEN
            RAISE EXCEPTION 'submission_id already exists'
                USING ERRCODE = '23505';
        END IF;

        IF v_norm IS NOT NULL THEN
            IF EXISTS (SELECT 1 FROM public.submission_batches sb WHERE sb.display_color = v_norm) THEN
                RAISE EXCEPTION 'submission display color already in use'
                    USING ERRCODE = '23505';
            END IF;
            v_color := v_norm;
        ELSE
            v_color := NULL;
            FOR i IN 1 .. array_length(palette, 1) LOOP
                IF NOT EXISTS (
                    SELECT 1 FROM public.submission_batches sb WHERE sb.display_color = palette[i]
                ) THEN
                    v_color := palette[i];
                    EXIT;
                END IF;
            END LOOP;
            IF v_color IS NULL THEN
                v_color := palette[1];
            END IF;
        END IF;

        INSERT INTO public.submission_batches (submission_id, submission_name, created_by, display_color)
        VALUES (p_submission_id, v_trim_name, uid, v_color);
    ELSE
        SELECT sb.created_by INTO batch_created_by
        FROM public.submission_batches sb
        WHERE sb.submission_id = p_submission_id;

        IF batch_created_by IS NULL THEN
            RAISE EXCEPTION 'submission batch not found'
                USING ERRCODE = 'P0001';
        END IF;

        IF batch_created_by <> uid AND NOT EXISTS (
            SELECT 1
            FROM public.geo_features gf
            JOIN public.project_members pm ON pm.project_id = gf.project_id
            WHERE gf.submission_id = p_submission_id
              AND pm.user_id = uid
              AND pm.role = ANY (ARRAY['owner'::text, 'editor'::text])
        ) THEN
            RAISE EXCEPTION 'not authorized to overwrite this submission'
                USING ERRCODE = '42501';
        END IF;

        DELETE FROM public.geo_features gf
        WHERE gf.submission_id = p_submission_id
          AND gf.project_id = ANY (allowed_projects);
    END IF;

    FOR elem IN SELECT t.value FROM jsonb_array_elements(p_feature_rows) AS t(value)
    LOOP
        v_project_id := (elem->>'project_id')::uuid;
        IF NOT (v_project_id = ANY (allowed_projects)) THEN
            RAISE EXCEPTION 'feature project_id outside workspace'
                USING ERRCODE = '22023';
        END IF;

        v_row_name := btrim(COALESCE(elem->>'name', ''));
        v_desc := btrim(COALESCE(elem->>'description', ''));
        v_lng := (elem->>'lng')::double precision;
        v_lat := (elem->>'lat')::double precision;

        IF elem ? 'feature_type'
           AND jsonb_typeof(elem->'feature_type') = 'string'
           AND btrim(elem->>'feature_type') <> ''
        THEN
            v_feature_type := elem->>'feature_type';
        ELSE
            v_feature_type := NULL;
        END IF;

        INSERT INTO public.geo_features (project_id, submission_id, name, description, geom, feature_type)
        VALUES (
            v_project_id,
            p_submission_id,
            v_row_name,
            v_desc,
            extensions.ST_SetSRID(extensions.ST_MakePoint(v_lng, v_lat), 4326)::extensions.geometry,
            v_feature_type
        );
    END LOOP;

    IF p_mode = 'overwrite' THEN
        IF v_norm IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM public.submission_batches sb
                WHERE sb.display_color = v_norm
                  AND sb.submission_id <> p_submission_id
            ) THEN
                RAISE EXCEPTION 'submission display color already in use'
                    USING ERRCODE = '23505';
            END IF;
            UPDATE public.submission_batches sb
            SET submission_name = v_trim_name,
                display_color = v_norm
            WHERE sb.submission_id = p_submission_id;
        ELSE
            UPDATE public.submission_batches sb
            SET submission_name = v_trim_name
            WHERE sb.submission_id = p_submission_id;
        END IF;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_unified_submission_write(text, uuid, text, uuid, uuid, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_unified_submission_write(text, uuid, text, uuid, uuid, jsonb, text) TO authenticated;

COMMENT ON FUNCTION public.submit_unified_submission_write(text, uuid, text, uuid, uuid, jsonb, text) IS
    'Unified submission write: new inserts batch+features with display_color (auto or explicit); overwrite replaces workspace features, updates name, and updates display_color only when p_submission_display_color is set.';
