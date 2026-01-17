-- Cloud Supabase seed file
-- Usage: Run this in SQL Editor after creating a user via Dashboard
--
-- BEFORE RUNNING THIS:
--   1. Go to Authentication → Users → Add User
--   2. Create user with email: test@gmail.com, password: password
--   3. Copy the user's UUID from the Dashboard
--   4. Replace 'YOUR-USER-UUID-HERE' below with that UUID

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
  '11e68115-3c9b-4555-afa6-f57e61d401b8',
  'owner'
);
