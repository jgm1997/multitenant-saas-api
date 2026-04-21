# Multi-tenant SaaS API

A production-grade REST API built with **NestJS**, **PostgreSQL**, and **Prisma** that demonstrates core patterns used in real SaaS applications — multi-tenancy, JWT authentication with refresh token rotation, and role-based access control.

---

## Why this project exists

Most portfolio APIs show CRUD over a single user table. This one solves a harder problem: **how do you build one application that serves many independent organizations, keeping their data completely isolated from each other?**

That's the core challenge of every SaaS product — and this project implements it end to end.

---

## Architecture highlights

### Multi-tenancy via shared schema + Prisma middleware
Every tenant (organization) shares the same database. Isolation is enforced by a **Prisma middleware** that automatically injects `tenantId` into every query, mutation, and delete — making it structurally impossible to leak data across tenants, even if a developer forgets to add a filter.

```
Incoming request
      │
      ▼
TenantMiddleware       reads x-tenant-slug header, loads tenant into AsyncLocalStorage
      │
      ▼
JwtAuthGuard           validates Bearer token (global — every route protected by default)
      │
      ▼
RolesGuard             checks @Roles() decorator against role hierarchy
      │
      ▼
ResourceOwnerGuard     verifies MEMBER-role users only mutate their own resources
      │
      ▼
Controller / Service   pure business logic — zero auth or tenant code
```

### Opt-out security model
Guards are registered globally via `APP_GUARD`. Every route requires authentication by default. Public routes are explicitly marked with `@Public()`. Forgetting to secure a new route is not possible.

### JWT + Refresh token rotation
- Access tokens expire in 15 minutes
- Refresh tokens are stored **hashed** in the database (bcrypt)
- Every refresh rotates the token — the old one is revoked immediately
- If a stolen token is detected (reuse of a revoked token), **all sessions for that user are revoked**

### Role hierarchy
```
OWNER > ADMIN > MEMBER
```
Roles are evaluated by hierarchy level — an `OWNER` automatically passes any `ADMIN`-required check. No need to whitelist every valid role per route.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | NestJS |
| Database | PostgreSQL 15 |
| ORM | Prisma |
| Auth | JWT (access + refresh) + Passport |
| Validation | class-validator + class-transformer |
| Testing | Jest + Supertest |
| Local infra | Docker Compose |

---

## Project structure

```
src/
├── common/
│   ├── decorators/        # @CurrentUser(), @Roles(), @Public()
│   ├── filters/           # GlobalExceptionFilter
│   └── guards/            # JwtAuthGuard, RolesGuard, ResourceOwnerGuard
├── config/
├── prisma/                # PrismaService (global module)
└── modules/
    ├── tenant/            # Tenant registration and lookup
    ├── auth/              # Register, login, refresh, logout
    └── projects/          # Sample tenant-scoped resource
```

---

## API reference

### Tenants (public)
```
POST   /api/v1/tenants           Create a new tenant
GET    /api/v1/tenants/:slug     Get tenant info
```

### Auth (public)
```
POST   /api/v1/auth/register     Register a user within a tenant
POST   /api/v1/auth/login        Login and receive tokens
POST   /api/v1/auth/refresh      Rotate refresh token
POST   /api/v1/auth/logout       Revoke all sessions
POST   /api/v1/auth/me           Get current user
```

### Projects (protected)
```
POST   /api/v1/projects          Create project (any role)
GET    /api/v1/projects          List projects (any role)
GET    /api/v1/projects/:id      Get project (any role)
PATCH  /api/v1/projects/:id      Update project (owner or ADMIN+)
DELETE /api/v1/projects/:id      Delete project (ADMIN+)
```

All protected routes require:
- `Authorization: Bearer <access_token>`
- `x-tenant-slug: <your-tenant-slug>`

---

## Getting started

### Prerequisites
- Node.js 18+
- Docker and Docker Compose

### 1. Clone and install
```bash
git clone https://github.com/yourusername/multitenant-saas-api
cd multitenant-saas-api
npm install
```

### 2. Environment setup
```bash
cp .env.example .env
# Edit .env with your values if needed
```

### 3. Start the database
```bash
docker-compose up -d
```

### 4. Run migrations
```bash
npx prisma migrate dev
```

### 5. Start the server
```bash
npm run start:dev
# Server running at http://localhost:3000/api/v1
```

---

## Running tests

```bash
# Unit and integration tests
npm run test

# With coverage
npm run test:cov

# E2E tests (requires test DB)
docker-compose up -d postgres_test
npx dotenv -e .env.test -- npx prisma migrate deploy
npm run test:e2e
```

---

## Key design decisions

**Why AsyncLocalStorage for tenant context?**
The alternative is passing `tenantId` through every service method call. AsyncLocalStorage stores request-scoped data in a way that's accessible anywhere in the call stack without threading it through function signatures — keeping services clean and framework-agnostic.

**Why hash refresh tokens?**
If the database is compromised, raw tokens would give an attacker instant access to all user sessions. Hashing refresh tokens means a DB breach alone is not enough to hijack sessions.

**Why global guards with opt-out instead of opt-in?**
Opt-in security (`@UseGuards()` on each route) means a developer adding a new route can accidentally ship an unprotected endpoint. Global guards with `@Public()` for exceptions make the secure path the default path.

**Why Prisma middleware for tenant scoping instead of service-level filtering?**
Service-level filtering depends on every developer remembering to add `where: { tenantId }` to every query. Prisma middleware enforces it at the ORM level — it's not a convention, it's a constraint.

---

## License

MIT