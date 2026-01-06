-- Local development seed file
-- Usage: supabase db reset (runs migrations + seed automatically)
--
-- Test user credentials:
--   Email: test@gmail.com
--   Password: password

-- Create test user in auth.users
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
  role,
  confirmation_token,
  recovery_token
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
  'authenticated',
  '',
  ''
);

-- Create identity for email provider (required for login to work)
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'test@gmail.com',
  'email',
  '{"sub": "00000000-0000-0000-0000-000000000001", "email": "test@gmail.com", "email_verified": true, "provider": "email"}',
  now(),
  now(),
  now()
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
