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

alter table "public"."geo_features" add constraint "geo_features_pkey" PRIMARY KEY using index "geo_features_pkey";

alter table "public"."project_members" add constraint "project_members_pkey" PRIMARY KEY using index "project_members_pkey";

alter table "public"."projects" add constraint "projects_pkey" PRIMARY KEY using index "projects_pkey";

alter table "public"."geo_features" add constraint "geo_features_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."geo_features" validate constraint "geo_features_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_project_id_fkey" FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE not valid;

alter table "public"."project_members" validate constraint "project_members_project_id_fkey";

alter table "public"."project_members" add constraint "project_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."project_members" validate constraint "project_members_user_id_fkey";

create policy "Editors can delete geometries"
on "public"."geo_features"
as permissive
for delete
to public
using ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = 'editor'::text)))));


create policy "Editors can insert geometries"
on "public"."geo_features"
as permissive
for insert
to public
with check ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));


create policy "Editors can update geometries"
on "public"."geo_features"
as permissive
for update
to public
using ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = ANY (ARRAY['owner'::text, 'editor'::text]))))));


create policy "Members can view geometries in their projects"
on "public"."geo_features"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = geo_features.project_id) AND (pm.user_id = auth.uid())))));


create policy "Members can see their own memberships"
on "public"."project_members"
as permissive
for select
to public
using ((auth.uid() = user_id));


create policy "Users can join projects (insert)"
on "public"."project_members"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


create policy "Members can view their projects"
on "public"."projects"
as permissive
for select
to public
using ((EXISTS ( SELECT 1
   FROM project_members pm
  WHERE ((pm.project_id = projects.id) AND (pm.user_id = auth.uid())))));




