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
- [Dev Tips](#dev-tips)

## Schema Overview

![Supabase Schema](src/assests/supabase-schema.png)

## Tables

| Table                 | Purpose                    | Key Fields                                                                           | Relationships                                  |
| --------------------- | -------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| **`projects`**        | Main project workspace     | `id` (UUID), `name`, `description`, `project_meta` (boundaries/config), `created_at` | Referenced by project_members and geo_features |
| **`project_members`** | User access control        | `project_id` (UUID), `user_id` (UUID), `role` (default: 'editor')                    | Links projects ↔ users                         |
| **`geo_features`**    | Map drawings/shapes        | `id` (UUID), `project_id`, `name`, `description`, `submission_id`, `geom` (GeoJSON), `created_at` | Belongs to a project                           |
| **`spatial_ref_sys`** | PostGIS coordinate systems | `srid`, `auth_name`, `srtext`, `proj4text`                                           | System table for map projections               |

### Key Relationships

- **Users** can be members of multiple **Projects** (many-to-many via project_members)
- Each **Project** can have many **Geographic Features** (one-to-many)
- **Project Members** have roles: `owner` or `editor` (default: 'editor')
  - Both roles can create, update, delete, and view geometries
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

### Option A: Online Mode (Supabase Cloud)

Best for: Production, staging, or if you don't want to run Docker locally.

1. Create a project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from **Settings** → **API**
3. Copy `.env.example` to `.env` and fill in your credentials

**If connecting to an existing database**, you're done - the schema and data are already there.

**If setting up a new database**, continue with:

4. **Reset the database schema**:
   - Go to **SQL Editor** in your Supabase dashboard
   - Copy and run the contents of `supabase/nuclear_reset.sql`
   - This will drop all existing tables and recreate the schema from migrations

5. **Seed test data** (optional):
   - Go to **Authentication** → **Users** → **Add User**
   - Create a user with email `test@gmail.com` and password `password`
   - Go to **SQL Editor** and run the contents of `supabase/seed_data.sql`
   - The script automatically finds the test user and creates:
     - **Otef Test** project
     - **Pink Line** project
     - Adds the test user as an editor to both projects

### Option B: Local Mode (Supabase Local)

Best for: Development, testing, or when you want full control over your database.

Local mode runs Supabase services in Docker containers on your machine.

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

4. **Copy environment variables**

   Copy `.env.example` to `.env` and use the local credentials shown in the terminal output.

5. **Reset database** (applies migrations + seed data)
   ```bash
   supabase db reset
   ```

   This creates a test user and project automatically.

## Database Management

### Test User Credentials

The seed file creates a test user you can use immediately (both local and cloud):

| Field    | Value            |
| -------- | ---------------- |
| Email    | `test@gmail.com` |
| Password | `password`       |

**Local mode**: This user is automatically added as owner of a "Test Project" when you run `supabase db reset`.

**Cloud mode**: After creating the user via Dashboard, run `supabase/seed_data.sql` to add the user as an editor to "Otef Test" and "Pink Line" projects.

### Database Reset (Cloud)

If you need to completely reset your cloud database:

1. Go to **SQL Editor** in your Supabase dashboard
2. Run `supabase/nuclear_reset.sql` to drop everything and recreate the schema
3. Run `supabase/seed_data.sql` to add test data (after creating the test user)

### Applying Migrations

- **Local mode**: Run `supabase db reset` to apply all migrations
- **Online mode**: Run migrations manually in the Supabase SQL Editor

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format

# Check code formatting
npm run format:check
```

## Dev Tips

### Code Formatting

This project uses **Prettier** for code formatting and **ESLint** for code quality checks.

### Git Blame Configuration

The `.git-blame-ignore-revs` file is configured to ignore formatting-only commits in git blame. To enable it, run:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

When you make a commit that only reformats code (e.g., running `npm run format`), add the commit SHA to `.git-blame-ignore-revs` to keep blame history clean.