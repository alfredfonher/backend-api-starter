# Backend API Starter

A production-shaped Fastify API starter for TypeScript backends. It includes PostgreSQL persistence, Prisma migrations, JWT authentication, role-based access control, owned project CRUD, Swagger/OpenAPI documentation, Docker Compose runtime assets, and Vitest coverage.

## Quick path

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env` and replace placeholder secrets.
3. Start PostgreSQL with `pnpm docker:up`.
4. Prepare the database with `pnpm db:migrate` and, optionally, `pnpm db:seed`.
5. Start the API with `pnpm dev`.
6. Open `http://localhost:3000/docs` for Swagger UI.

## Features

- Fastify HTTP API with TypeScript.
- PostgreSQL persistence through Prisma.
- JWT bearer authentication with registration, login, and current-user endpoints.
- Role-based access control with `ADMIN` and `USER` roles.
- User management with protected self-access and admin-only list/delete behavior.
- Project CRUD with owner-scoped access for regular users and global access for admins.
- Swagger UI and OpenAPI JSON served by the application.
- Dockerfile and Docker Compose assets for local runtime services.
- Vitest integration and E2E tests using Fastify `app.inject()`.

## Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 20, Fastify 4 |
| Language | TypeScript |
| Database | PostgreSQL 17 |
| ORM | Prisma 5 |
| Auth | `@fastify/jwt`, bcrypt |
| API docs | `@fastify/swagger`, `@fastify/swagger-ui` |
| Testing | Vitest |
| Package manager | pnpm 9 |
| Local runtime | Docker Compose |

## Architecture

`src/app.ts` builds the Fastify app for runtime and tests. `src/server.ts` only loads environment settings and starts listening. Feature modules own routes, controllers, services, repositories, and schemas. Shared plugins and utilities provide Prisma, JWT, Swagger, security, validation errors, pagination, and response shaping.

The module layout follows this shape:

```text
src/
  app.ts                 # Fastify app composition
  server.ts              # Runtime entrypoint
  config/                # Environment and OpenAPI config
  middlewares/           # Auth, authorization, and error handling
  modules/
    auth/                # Register, login, current user
    health/              # Health check
    projects/            # Project CRUD and ownership rules
    users/               # User read/update/list/delete rules
  plugins/               # Fastify plugins for Prisma, JWT, Swagger, security
  utils/                 # Shared errors, pagination, password, response helpers
```

## Prerequisites

- Node.js 20 or newer.
- pnpm 9.15.9 or compatible.
- Docker and Docker Compose for the default local PostgreSQL workflow.
- A PostgreSQL database if you do not use Compose.

## Installation

```bash
pnpm install
cp .env.example .env
pnpm docker:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The development API listens on `http://localhost:3000` by default.

## Environment

Use `.env.example` as the template. Required runtime values include `DATABASE_URL`, `JWT_SECRET`, and the server settings. The example intentionally uses placeholders for secrets; do not commit real `.env` files.

| Variable | Required | Default/example | Purpose |
|---|---:|---|---|
| `NODE_ENV` | Yes | `development` | Runtime mode: `development`, `test`, or `production`. |
| `PORT` | Yes | `3000` | HTTP port used by `pnpm dev` and `pnpm start`. |
| `HOST` | Yes | `0.0.0.0` | HTTP bind address. |
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5050/backend_api_starter?schema=public` | Prisma database connection for runtime and DB-backed tests. |
| `TEST_DATABASE_URL` | Recommended | `postgresql://postgres:postgres@localhost:5050/backend_api_starter_test?schema=public` | Dedicated test database URL for local workflows that need a separate database. |
| `JWT_SECRET` | Yes | `replace-with-at-least-32-characters` | Secret used to sign JWT access tokens. Replace it locally and in deployed environments. |
| `JWT_EXPIRES_IN` | No | `1h` | JWT access token lifetime. |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing cost. Must be an integer from 10 to 14. |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin. |
| `SEED_ADMIN_NAME` | Seed only | `Admin User` | Optional initial admin display name. |
| `SEED_ADMIN_EMAIL` | Seed only | `admin@example.com` | Optional initial admin email. |
| `SEED_ADMIN_PASSWORD` | Seed only | `change-me-in-local-env` | Optional initial admin password. |

## Local development

```bash
pnpm docker:up       # Start PostgreSQL and the API container if needed
pnpm db:migrate     # Apply local Prisma migrations
pnpm db:seed        # Optional: create or update the seed admin user
pnpm dev            # Run the API directly with tsx watch
```

For direct local development, the Compose-managed PostgreSQL service is exposed on `localhost:5050`. The checked-in `.env.example` and local `.env` defaults point `DATABASE_URL` and `TEST_DATABASE_URL` at that host port.

## Docker

Build and start local runtime services with `pnpm docker:up`. The API is published at `http://localhost:5055`, while the API container still reaches Postgres through the `postgres` service on container port `5432`. Stop services with `pnpm docker:down`.

```bash
pnpm docker:up
curl http://localhost:5055/health
pnpm docker:down
```

Host-facing ports:

| Service | Host URL | Container port |
|---|---|---:|
| API | `http://localhost:5055` | `3000` |
| PostgreSQL | `localhost:5050` | `5432` |

## Database

The API persists `User` and `Project` records through Prisma and PostgreSQL. The Compose file exposes the development PostgreSQL service on host port `5050`. Use `TEST_DATABASE_URL` to point tests at a dedicated test database.

Common database commands:

```bash
pnpm db:generate    # Generate Prisma Client
pnpm db:migrate     # Create/apply development migrations
pnpm db:seed        # Seed an optional admin user
pnpm db:studio      # Open Prisma Studio
```

Seed variables are optional. When `SEED_ADMIN_NAME`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` are present, `pnpm db:seed` creates one admin user by normalized email or updates the existing user's name and role. It does not rotate an existing password.

## Testing

```bash
pnpm test           # Run Vitest once
pnpm test:tui       # Run Vitest with the custom terminal UI reporter
pnpm test:watch     # Run Vitest in watch mode
pnpm build          # Compile TypeScript
```

Integration tests use Fastify `app.inject()` and the configured PostgreSQL database when `DATABASE_URL` is available. Vitest is configured with `allowOnly: false` and single-file execution to keep shared database cleanup deterministic.

Before running DB-backed tests locally, start Compose PostgreSQL and ensure the schema is migrated:

```bash
pnpm docker:up
pnpm db:migrate
pnpm test
```

## API documentation

Swagger UI is available at `/docs`. The OpenAPI JSON document is available at `/docs/json`. The OpenAPI document groups operations with `Health`, `Auth`, `Users`, and `Projects` tags. Protected endpoints are marked with Bearer JWT authentication.

Examples:

```bash
curl http://localhost:3000/docs/json
open http://localhost:3000/docs
```

When running through Docker Compose, use `http://localhost:5055/docs` and `http://localhost:5055/docs/json`.

## Authentication model

The API uses short-lived JWT access tokens signed with `JWT_SECRET`.

1. Register a user with `POST /api/auth/register` or seed an admin user.
2. Login with `POST /api/auth/login`.
3. Send the token on protected requests with an `Authorization` header.

```http
Authorization: Bearer <accessToken>
```

Regular users can read and update their own user record and manage their own projects. Admin users can list users and can access all projects. Delete-user operations are admin-only, and admins cannot delete their own account through the API.

## API overview

All JSON examples show the primary request shape. Validation errors are returned by the shared error handler.

### Health

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | No | Return runtime health status and timestamp. |

### Auth

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | No | Create a regular user. |
| `POST` | `/api/auth/login` | No | Exchange email and password for a JWT access token. |
| `GET` | `/api/auth/me` | Yes | Return the authenticated user's token identity. |

Register request:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "password123"
}
```

Login request:

```json
{
  "email": "ada@example.com",
  "password": "password123"
}
```

### Users

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/users?page=1&limit=10&search=ada` | Admin | List users with pagination and optional search. |
| `GET` | `/api/users/:id` | User/Admin | Read a user. Regular users can only read themselves. |
| `PATCH` | `/api/users/:id` | User/Admin | Update a user. Only admins can change roles. |
| `DELETE` | `/api/users/:id` | Admin | Delete a user. Admin self-delete is blocked. |

Update request:

```json
{
  "name": "Ada Byron",
  "email": "ada.byron@example.com"
}
```

Admin role update request:

```json
{
  "role": "ADMIN"
}
```

### Projects

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/api/projects` | Yes | Create a project owned by the authenticated user. |
| `GET` | `/api/projects?page=1&limit=10&status=ACTIVE&search=api` | Yes | List projects. Regular users only see their own projects; admins see all projects. |
| `GET` | `/api/projects/:id` | Yes | Read a project if the caller owns it or is an admin. |
| `PATCH` | `/api/projects/:id` | Yes | Update a project if the caller owns it or is an admin. |
| `DELETE` | `/api/projects/:id` | Yes | Delete a project if the caller owns it or is an admin. |

Project statuses are `PENDING`, `ACTIVE`, `COMPLETED`, and `ARCHIVED`.

Create request:

```json
{
  "title": "API Starter",
  "description": "Reusable backend starter project",
  "status": "ACTIVE"
}
```

Update request:

```json
{
  "status": "COMPLETED"
}
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run the API with `tsx watch`. |
| `pnpm build` | Compile TypeScript into `dist/`. |
| `pnpm start` | Run the compiled API from `dist/server.js`. |
| `pnpm test` | Run Vitest once. |
| `pnpm test:tui` | Run Vitest once with the custom terminal UI reporter. |
| `pnpm test:watch` | Run Vitest in watch mode. |
| `pnpm db:migrate` | Apply Prisma migrations in development. |
| `pnpm db:generate` | Generate the Prisma client. |
| `pnpm db:seed` | Seed the optional initial admin user. |
| `pnpm db:studio` | Open Prisma Studio. |
| `pnpm docker:up` | Start Docker Compose services in the background. |
| `pnpm docker:down` | Stop Docker Compose services. |

## Notable design decisions and limitations

- The API container uses internal Compose networking with `postgres:5432`; host tools use `localhost:5050`.
- Local tests currently use Prisma's `DATABASE_URL`; keep it pointed at a disposable local database before running destructive DB-backed tests.
- Passwords are hashed with bcrypt and never returned by API responses.
- JWT access tokens are supported; refresh tokens, token rotation, OAuth, and email verification are intentionally out of scope.
- The API is intentionally REST-first. GraphQL, WebSockets, multi-tenancy, payments, audit logs, soft deletes, advanced rate limiting, Kubernetes manifests, and advanced CI/CD are backlog items rather than starter scope.
