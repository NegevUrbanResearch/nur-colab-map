-- Cloud Supabase seed file
-- Usage: Run this in SQL Editor after creating a user via Dashboard
--
-- BEFORE RUNNING THIS:
--   1. Go to Authentication → Users → Add User
--   2. Create a real user with your own email + strong password
--   3. Set target_email below to that user's email
--   4. Do not use shared test credentials in cloud environments

DO $$
DECLARE
    target_email text := 'CHANGE_ME_EMAIL@example.com';
    test_user_id uuid;
BEGIN
    IF target_email = 'CHANGE_ME_EMAIL@example.com' THEN
        RAISE EXCEPTION 'Set target_email in supabase/seed.cloud.sql before running this script';
    END IF;

    -- Find user by email
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE lower(email) = lower(target_email)
    LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found. Please create user with email % via Dashboard first', target_email;
    END IF;
    -- Create Memorial Sites project
    INSERT INTO public.projects (id, name, description, created_at)
    VALUES (
        '33333333-3333-3333-3333-333333333333',
        'Memorial Sites',
        'אתרי הנצחה',
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    
    -- Create Testimony project
    INSERT INTO public.projects (id, name, description, created_at)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        'Testimony',
        'Testimony project',
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Create Pink Line project
    INSERT INTO public.projects (id, name, description, created_at)
    VALUES (
        '22222222-2222-2222-2222-222222222222',
        'Pink Line',
        'Pink Line project',
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Add target user as editor to Testimony project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';
    
    -- Add target user as editor to Pink Line project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '22222222-2222-2222-2222-222222222222',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';
    
    -- Add target user as editor to Memorial Sites project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '33333333-3333-3333-3333-333333333333',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';

    RAISE NOTICE 'Seed data created successfully. User ID: %', test_user_id;
END $$;
