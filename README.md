# Bluestock API Backend

This backend is built as a serverless-friendly Express API for Vercel deployment.

## Vercel deployment

The backend is configured to deploy from the `bluestock_api/backend` folder using `vercel.json` and `api/[[...all]].js`.

- `vercel.json` configures the Node runtime and secret-backed environment variables.
- `api/[[...all]].js` wraps the existing Express application so the API routes work in Vercel serverless functions.

## Environment variables

Copy `.env.example` to `.env` for local development.

Required variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Recommended variables:

- `FRONTEND_URL`
- `ADMIN_BUSINESS_NAME`
- `ADMIN_PHONE`
- `ADMIN_GST`

> In Vercel, configure these as project environment variables or secrets. The `vercel.json` file references secret names such as `@DATABASE_URL` and `@JWT_SECRET`.

## Local development

Install dependencies and run the backend locally:

```bash
npm install
npm run dev
```

## Migration safety

This project includes migration scripts and operational guidance:

- `npm run migrate:dev` — run migrations locally and generate new migration files
- `npm run migrate:deploy` — apply migrations in production
- `npm run migrate:status` — inspect migration status
- `npm run migrate:rollback` — display rollback guidance

### Rollback plan

If a production migration fails:

1. Restore from database backup or snapshot.
2. If only the last migration must be marked as rolled back, use Prisma:
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```
3. Re-run `npm run migrate:deploy` after fixing the migration.

> Always back up your database before applying schema changes.

## GitHub Actions

Auto-deployment is wired in `.github/workflows/backend-deploy.yml`.

The workflow deploys on pushes to `main`, `staging`, and `preview` branches.

### Required GitHub secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Notes

- `src/lib/env.js` centralizes env handling.
- `src/lib/redis.js` falls back to an in-memory cache when Upstash Redis is not configured, which is useful for local development but not suitable for production.
