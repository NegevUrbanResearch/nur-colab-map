-- NUCLEAR RESET: Drops EVERYTHING in public schema and recreates from scratch
-- WARNING: This will delete all data and all objects in the public schema
-- Run this in your Supabase SQL Editor

-- Disable RLS temporarily to allow dropping
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies from all tables
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I CASCADE', 
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Drop all tables in public schema (CASCADE handles dependencies)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename 
              FROM pg_tables 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
    END LOOP;
END $$;

-- Drop all views in public schema
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT viewname 
              FROM pg_views 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.viewname);
    END LOOP;
END $$;

-- Drop all sequences in public schema
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequence_name 
              FROM information_schema.sequences 
              WHERE sequence_schema = 'public') 
    LOOP
        EXECUTE format('DROP SEQUENCE IF EXISTS public.%I CASCADE', r.sequence_name);
    END LOOP;
END $$;

-- Drop all functions in public schema
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT routine_name, routine_type
              FROM information_schema.routines 
              WHERE routine_schema = 'public'
              AND routine_name NOT LIKE 'pg_%') 
    LOOP
        EXECUTE format('DROP %s IF EXISTS public.%I CASCADE', 
                       CASE WHEN r.routine_type = 'FUNCTION' THEN 'FUNCTION' ELSE 'PROCEDURE' END,
                       r.routine_name);
    END LOOP;
END $$;

-- Drop all types in public schema (except built-ins)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT typname 
              FROM pg_type t
              JOIN pg_namespace n ON n.oid = t.typnamespace
              WHERE n.nspname = 'public'
              AND t.typtype = 'c'
              AND typname NOT LIKE 'pg_%') 
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Now recreate everything from scratch

-- Migration 1: Initial Schema (20251001000000_initial_schema.sql)
create extension if not exists "postgis" with schema "extensions";

create table "public"."geo_features" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "project_id" uuid,
    "name" text,
    "created_at" timestamp with time zone default now(),
    "geom" extensions.geometry
);

alter table "public"."geo_features" enable row level security;

create table "public"."project_members" (
    "project_id" uuid not null,
    "user_id" uuid not null,
    "role" text default 'editor'::text
);

alter table "public"."project_members" enable row level security;

create table "public"."projects" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default now(),
    "project_meta" extensions.geometry
);

alter table "public"."projects" enable row level security;

CREATE UNIQUE INDEX geo_features_pkey ON public.geo_features USING btree (id);
CREATE UNIQUE INDEX project_members_pkey ON public.project_members USING btree (project_id, user_id);
CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id);

ALTER TABLE "public"."geo_features" ADD CONSTRAINT "geo_features_pkey" PRIMARY KEY USING INDEX "geo_features_pkey";
ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_pkey" PRIMARY KEY USING INDEX "project_members_pkey";
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_pkey" PRIMARY KEY USING INDEX "projects_pkey";

ALTER TABLE "public"."geo_features" ADD CONSTRAINT "geo_features_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE "public"."project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Editors can delete geometries"
ON "public"."geo_features"
AS PERMISSIVE
FOR DELETE
TO public
USING ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));

CREATE POLICY "Editors can insert geometries"
ON "public"."geo_features"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));

CREATE POLICY "Editors can update geometries"
ON "public"."geo_features"
AS PERMISSIVE
FOR UPDATE
TO public
USING ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));

CREATE POLICY "Members can view geometries in their projects"
ON "public"."geo_features"
AS PERMISSIVE
FOR SELECT
TO public
USING ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid())))));

CREATE POLICY "Members can see their own memberships"
ON "public"."project_members"
AS PERMISSIVE
FOR SELECT
TO public
USING ((auth.uid() = user_id));

CREATE POLICY "Users can join projects (insert)"
ON "public"."project_members"
AS PERMISSIVE
FOR INSERT
TO public
WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Members can view their projects"
ON "public"."projects"
AS PERMISSIVE
FOR SELECT
TO public
USING ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = projects.id) AND (pm.user_id = auth.uid())))));

-- Migration 2: Add submission_id (20250125000000_add_submission_id.sql)
ALTER TABLE "public"."geo_features" ADD COLUMN "submission_id" uuid;

-- Migration 3: Add description (20250126000000_add_description_to_geo_features.sql)
ALTER TABLE "public"."geo_features" ADD COLUMN "description" text;
