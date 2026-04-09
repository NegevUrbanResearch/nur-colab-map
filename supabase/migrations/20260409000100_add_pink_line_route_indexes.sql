CREATE INDEX IF NOT EXISTS geo_features_pink_route_lookup_idx
ON public.geo_features (project_id, feature_type, submission_id, created_at DESC)
WHERE feature_type = 'pink_line_route';
