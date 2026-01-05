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

## Getting Started

### Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**
- **Supabase account** (for cloud setup) or **Supabase CLI** (for local development)

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Supabase

You can use either **Supabase Cloud** (recommended) or **Supabase Local** (for local development).

#### Option A: Using Supabase Cloud

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from **Settings** → **API**
3. Copy `.env.example` to `.env` and fill in your credentials
4. Apply the database schema by running the SQL from `supabase/migrations/20251001185609_remote_schema.sql` in your Supabase SQL Editor (Dashboard → SQL Editor)

#### Option B: Using Supabase Local

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```
2. Start local Supabase:
   ```bash
   supabase start
   ```
3. Copy `.env.example` to `.env` and use the local credentials shown in the terminal output
4. Apply migrations:
   ```bash
   supabase db push
   ```

### 3. Create test user

For development, create a test user:

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **"Add user"** or **"Create new user"**
3. Enter:
   - **Email**: `test`
   - **Password**: `password`
   - Check **"Auto Confirm User"** (to skip email confirmation)
4. Click **"Create user"**

**Optional**: Disable email confirmation for easier development:
- Go to **Authentication** → **Settings**
- Under **"Email Auth"**, toggle **"Enable email confirmations"** to OFF

### 5. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal).
