create extension if not exists "postgis" with schema "extensions";


create table if not exists "public"."geo_features" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "project_id" uuid,
    "name" text,
    "created_at" timestamp with time zone default now(),
    "geom" extensions.geometry
);


alter table "public"."geo_features" enable row level security;

create table if not exists "public"."project_members" (
    "project_id" uuid not null,
    "user_id" uuid not null,
    "role" text default 'editor'::text
);


alter table "public"."project_members" enable row level security;

create table if not exists "public"."projects" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "project_meta" extensions.geometry
);


alter table "public"."projects" enable row level security;

CREATE UNIQUE INDEX IF NOT EXISTS geo_features_pkey ON public.geo_features USING btree (id);

CREATE UNIQUE INDEX IF NOT EXISTS project_members_pkey ON public.project_members USING btree (project_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS projects_pkey ON public.projects USING btree (id);

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geo_features_pkey') THEN
        ALTER TABLE "public"."geo_features" ADD CONSTRAINT "geo_features_pkey" PRIMARY KEY USING INDEX "geo_features_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_pkey') THEN
        ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_pkey" PRIMARY KEY USING INDEX "project_members_pkey";
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_pkey') THEN
        ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY USING INDEX "projects_pkey";
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'geo_features_project_id_fkey') THEN
        ALTER TABLE "public"."geo_features" ADD CONSTRAINT "geo_features_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_id_fkey') THEN
        ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_user_id_fkey') THEN
        ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_features' AND policyname = 'Editors can delete geometries') THEN
        CREATE POLICY "Editors can delete geometries"
        ON "public"."geo_features"
        AS PERMISSIVE
        FOR DELETE
        TO public
        USING ((EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_features' AND policyname = 'Editors can insert geometries') THEN
        CREATE POLICY "Editors can insert geometries"
        ON "public"."geo_features"
        AS PERMISSIVE
        FOR INSERT
        TO public
        WITH CHECK ((EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_features' AND policyname = 'Editors can update geometries') THEN
        CREATE POLICY "Editors can update geometries"
        ON "public"."geo_features"
        AS PERMISSIVE
        FOR UPDATE
        TO public
        USING ((EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'geo_features' AND policyname = 'Members can view geometries in their projects') THEN
        CREATE POLICY "Members can view geometries in their projects"
        ON "public"."geo_features"
        AS PERMISSIVE
        FOR SELECT
        TO public
        USING ((EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid())))));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members' AND policyname = 'Members can see their own memberships') THEN
        CREATE POLICY "Members can see their own memberships"
        ON "public"."project_members"
        AS PERMISSIVE
        FOR SELECT
        TO public
        USING ((auth.uid() = user_id));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members' AND policyname = 'Users can join projects (insert)') THEN
        CREATE POLICY "Users can join projects (insert)"
        ON "public"."project_members"
        AS PERMISSIVE
        FOR INSERT
        TO public
        WITH CHECK ((auth.uid() = user_id));
    END IF;
END $$;


DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'Members can view their projects') THEN
        CREATE POLICY "Members can view their projects"
        ON "public"."projects"
        AS PERMISSIVE
        FOR SELECT
        TO public
        USING ((EXISTS ( SELECT 1
           FROM project_members pm
          WHERE ((pm.project_id = projects.id) AND (pm.user_id = auth.uid())))));
    END IF;
END $$;




