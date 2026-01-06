# nur-map

A web application for mapping and visualizing data using Supabase and React.

## To Do: 
- [ ] Add github action backup for Supabase database https://supabase.com/docs/guides/deployment/ci/backups 

## Features

- 🗺️ Interactive mapping with Leaflet
- ✏️ Draw and edit geometric features (polygons, lines, points)
- 👥 Multi-user project management
- 🔐 Authentication with Supabase Auth
- 📊 GeoJSON data storage and visualization

## Table of Contents

- [Schema Overview](#schema-overview)
- [Quick Start](#quick-start)
- [Backend Mode: Local vs Online](#backend-mode-local-vs-online)
- [Database Management](#database-management)
- [Development Commands](#development-commands)

## Schema Overview

![Supabase Schema](src/assests/supabase-schema.png)

## Tables

| Table                 | Purpose                    | Key Fields                                                                           | Relationships                                  |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **`projects`**        | Main project workspace     | `id` (UUID), `name`, `description`, `project_meta` (boundaries/config), `created_at` | Referenced by project_members and geo_features |
| **`project_members`** | User access control        | `project_id` (UUID), `user_id` (UUID), `role` (default: 'editor')                    | Links projects ↔ users                         |
| **`geo_features`**    | Map drawings/shapes        | `id` (UUID), `project_id`, `name`, `geom` (GeoJSON), `created_at`                    | Belongs to a project                           |
| **`spatial_ref_sys`** | PostGIS coordinate systems | `srid`, `auth_name`, `srtext`, `proj4text`                                           | System table for map projections               |

### Key Relationships

- **Users** can be members of multiple **Projects** (many-to-many via project_members)
- Each **Project** can have many **Geographic Features** (one-to-many)
- **Project Members** have roles (currently defaulting to 'editor')
- All geographic data is stored as GeoJSON in the `geom` field

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/products/docker-desktop/) (for local mode)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (for local mode)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nur-colab-map
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Choose your backend mode** (see [Backend Mode](#backend-mode-local-vs-online) below)

4. **Run the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

---

## Backend Mode: Local vs Online

The application can run with either a **local Supabase instance** (for development) or an **online Supabase project** (for production/staging).

### 🏠 Local Mode (Recommended for Development)

Local mode runs Supabase services in Docker containers on your machine, giving you full control over your development database.

#### Setup Local Mode

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Start Docker Desktop**
   
   Make sure Docker is running on your machine.

3. **Start local Supabase services**
   ```bash
   supabase start
   ```
   
   This will:
   - Download and start all Supabase services in Docker
   - Output local credentials (API URL, anon key, etc.)
   - Start PostgreSQL with PostGIS extension
   - Start Studio UI at `http://127.0.0.1:54323`

4. **Configure environment variables**
   
   Create a `.env` file in the project root:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with the credentials from `supabase start` output:
   ```env
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=your-local-anon-key-from-output
   ```

5. **Apply database migrations**
   ```bash
   supabase db reset
   ```
   
   This creates all tables, indexes, and policies defined in `supabase/migrations/`.

6. **Access local Supabase Studio**
   
   Open `http://127.0.0.1:54323` in your browser to:
   - View and edit tables
   - Run SQL queries
   - Manage users
   - Monitor logs

#### Stop Local Services

```bash
supabase stop
```

### ☁️ Online Mode (Production/Staging)

Online mode connects to a hosted Supabase project for production or staging environments.

#### Setup Online Mode

1. **Create a Supabase project**
   
   Go to [supabase.com](https://supabase.com) and create a new project.

2. **Get your credentials**
   
   In your Supabase project dashboard:
   - Go to **Settings** → **API**
   - Copy the **Project URL** and **anon public** key

3. **Configure environment variables**
   
   Update your `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   ```

4. **Push migrations to online database** (first time only)
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```

### 🔄 Switching Between Modes

Simply update your `.env` file with the appropriate credentials:

**Switch to Local:**
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<key-from-supabase-start-output>
```

**Switch to Online:**
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=<key-from-supabase-dashboard>
```

Restart your dev server after changing the `.env` file.

---

## Database Management

### Accessing the Database

#### Local Mode
- **Studio UI**: `http://127.0.0.1:54323`
- **Direct PostgreSQL**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Use psql**:
  ```bash
  supabase db psql
  ```

#### Online Mode
- **Studio UI**: Your Supabase project dashboard → Table Editor
- **Direct connection**: Use the connection string from Settings → Database

### Manual Data Entry

#### Method 1: Supabase Studio (Recommended)

**Local**: Navigate to `http://127.0.0.1:54323`  
**Online**: Navigate to your Supabase project dashboard

##### Add a User
1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Enter email and password
4. Copy the generated User UUID (needed for project membership)

##### Add a Project
1. Go to **Table Editor** → **projects**
2. Click **Insert** → **Insert row**
3. Fill in:
   - `name`: Project name (required)
   - `description`: Project description (optional)
   - `project_meta`: GeoJSON geometry for project boundaries (optional)
   - `id` and `created_at` auto-generate, leave blank

##### Add Project Members
1. Go to **Table Editor** → **project_members**
2. Click **Insert** → **Insert row**
3. Fill in:
   - `project_id`: UUID of the project (from projects table)
   - `user_id`: UUID of the user (from auth.users)
   - `role`: Either `'owner'` or `'editor'` (default: `'editor'`)

##### Add Geographic Features
1. Go to **Table Editor** → **geo_features**
2. Click **Insert** → **Insert row**
3. Fill in:
   - `project_id`: UUID of the project
   - `name`: Feature name (e.g., "Building A", "Park Boundary")
   - `geom`: GeoJSON geometry
   
   Example GeoJSON for `geom`:
   ```json
   {"type":"Point","coordinates":[-122.4194,37.7749]}
   ```

#### Method 2: SQL Commands

##### Add a User (via SQL)
```sql
-- Users are managed by Supabase Auth, create via Studio or Auth API
-- To get existing users:
SELECT id, email FROM auth.users;
```

##### Add a Project
```sql
INSERT INTO projects (name, description, project_meta)
VALUES (
  'Downtown Revitalization',
  'Urban planning project for downtown area',
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.42,37.77],[-122.41,37.77],[-122.41,37.78],[-122.42,37.78],[-122.42,37.77]]]}')
);
```

##### Add Project Members
```sql
-- First, get the project ID and user ID
-- SELECT id FROM projects WHERE name = 'Downtown Revitalization';
-- SELECT id FROM auth.users WHERE email = 'user@example.com';

INSERT INTO project_members (project_id, user_id, role)
VALUES (
  'project-uuid-here',
  'user-uuid-here',
  'editor'  -- or 'owner'
);
```

##### Add Geographic Features
```sql
INSERT INTO geo_features (project_id, name, geom)
VALUES (
  'project-uuid-here',
  'City Hall',
  ST_GeomFromGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}')
);

-- For a polygon:
INSERT INTO geo_features (project_id, name, geom)
VALUES (
  'project-uuid-here',
  'Park Boundary',
  ST_GeomFromGeoJSON('{"type":"Polygon","coordinates":[[[-122.42,37.77],[-122.41,37.77],[-122.41,37.78],[-122.42,37.78],[-122.42,37.77]]]}')
);
```

### Common Database Queries

#### View all projects with member counts
```sql
SELECT 
  p.id,
  p.name,
  p.description,
  COUNT(pm.user_id) as member_count
FROM projects p
LEFT JOIN project_members pm ON p.id = pm.project_id
GROUP BY p.id, p.name, p.description;
```

#### View all features in a project
```sql
SELECT 
  gf.id,
  gf.name,
  gf.created_at,
  ST_AsGeoJSON(gf.geom) as geometry
FROM geo_features gf
WHERE gf.project_id = 'project-uuid-here';
```

#### View user's project access
```sql
SELECT 
  p.name as project_name,
  pm.role,
  u.email
FROM project_members pm
JOIN projects p ON pm.project_id = p.id
JOIN auth.users u ON pm.user_id = u.id
WHERE u.email = 'user@example.com';
```

### Resetting Local Database

To start fresh with a clean database:

```bash
supabase db reset
```

This drops all data and re-applies migrations.

---

## Development Commands

### Build & Run
```bash
npm run dev          # Start development server (Vite)
npm run build        # Build for production (TypeScript + Vite)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint (max 0 warnings)
```

### Supabase (Local Mode)
```bash
supabase start       # Start local Supabase stack
supabase stop        # Stop local Supabase stack
supabase status      # View running services and credentials
supabase db reset    # Reset database and apply migrations
supabase db psql     # Open PostgreSQL shell
supabase db diff     # Generate migration from schema changes
```

---



Manual update of location of supabase db table: 

{
    "type": "Point",
    "coordinates": [-122.4194, 37.7749]
}## Manual Update of Location of Supabase DB Table