-- Cloud Supabase seed file
-- Usage: Run this in SQL Editor after creating a user via Dashboard
--
-- BEFORE RUNNING THIS:
--   1. Go to Authentication → Users → Add User
--   2. Create user with email: test@gmail.com, password: password
--   3. The script will automatically find the user by email

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
    
    RAISE NOTICE 'Seed data created successfully. Test user ID: %', test_user_id;
END $$;
