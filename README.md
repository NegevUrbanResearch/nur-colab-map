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

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. Set up Supabase database

Create the above tables and policies in your Supabase database using the SQL editor.

### 4. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173) (or the port shown in your terminal).
