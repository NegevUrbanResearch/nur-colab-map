-- Seed Data: Test User, Projects, and Memberships
-- Run this AFTER resetting the database schema
--
-- Test user credentials:
--   Email: test@gmail.com
--   Password: password
--
-- Note: The script automatically finds the test user by email

DO $$
DECLARE
    test_user_id uuid;
BEGIN
    -- Find test user by email
    SELECT id INTO test_user_id 
    FROM auth.users 
    WHERE email = 'test@gmail.com' 
    LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE EXCEPTION 'Test user not found. Please create user with email test@gmail.com via Dashboard first';
    END IF;
    
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

    -- Create Memorial Sites project
    INSERT INTO public.projects (id, name, description, created_at)
    VALUES (
        '33333333-3333-3333-3333-333333333333',
        'Memorial Sites',
        'אתרי הנצחה',
        now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Add test user as editor to Testimony project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '11111111-1111-1111-1111-111111111111',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';
    
    -- Add test user as editor to Pink Line project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '22222222-2222-2222-2222-222222222222',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';

    -- Add test user as editor to Memorial Sites project
    INSERT INTO public.project_members (project_id, user_id, role)
    VALUES (
        '33333333-3333-3333-3333-333333333333',
        test_user_id,
        'editor'
    )
    ON CONFLICT (project_id, user_id) DO UPDATE SET role = 'editor';
    
    RAISE NOTICE 'Seed data created successfully. Test user ID: %', test_user_id;
END $$;
