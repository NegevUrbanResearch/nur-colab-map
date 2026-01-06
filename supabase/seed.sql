-- Seed file for local development
-- Run with: supabase db reset (this runs migrations + seed)

-- Create test user in auth.users
-- Email: test@gmail.com
-- Password: password
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'test@gmail.com',
  crypt('password', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  'authenticated',
  'authenticated'
);

-- Create a test project
INSERT INTO public.projects (id, name, description, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Test Project',
  'A sample project for development and testing',
  now()
);

-- Add test user as owner of the test project
INSERT INTO public.project_members (project_id, user_id, role)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'owner'
);
