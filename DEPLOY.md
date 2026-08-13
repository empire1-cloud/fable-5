# Deploying FABLE-5

The live site at `fable-5-omega.vercel.app` serves only `app/dist` — a static
bundle with no API behind it. Every `/api/*` call lands on static hosting, and
a POST there returns **405**. That is why founding access fails; sign-in and
the control plane fail the same way.

This guide puts the real `scale-v2` control plane online and points the front
end at it. Nothing here reimplements the server for a serverless runtime — the
deployed process is the same Express app the test suite covers, so what ships
is what is tested.

---

## What you are deploying

| Piece | Where it goes | Why |
|---|---|---|
| `scale-v2` | Render (Docker web service) | Long-lived Express process + a real connection pool. |
| PostgreSQL | Render managed database | Row-level security needs a real Postgres, not an edge KV. |
| `app` | Vercel (already there) | Static bundle; only needs `VITE_API_BASE` set. |

---

## 1 — Provision the API and its database

In Render: **New → Blueprint**, point it at this repository. It reads
[`render.yaml`](render.yaml) and creates a `fable5-control-plane` web service
plus a `fable5-db` PostgreSQL instance.

Render will ask for the values marked `sync: false`. They are not in the
blueprint on purpose — they are secrets or your own address, and a config file
should not decide them:

| Variable | What to put |
|---|---|
| `APP_ORIGIN` | `https://fable-5-omega.vercel.app` (comma-separate more origins if you add a custom domain) |
| `BOOTSTRAP_TENANT_NAME` | Your organisation name, e.g. `Empire-1` |
| `BOOTSTRAP_ADMIN_EMAIL` | The founder account's email |
| `BOOTSTRAP_ADMIN_PASSWORD` | A strong password you choose — this is your sign-in |
| `DATABASE_URL` | See below |

### Building `DATABASE_URL`

Migrations run as the database **owner** (`DATABASE_ADMIN_URL`, wired in
automatically). The app itself connects as `fable5_app`, a role that is
`NOSUPERUSER` and `NOBYPASSRLS` — so tenant isolation cannot be bypassed even
by the application's own credentials. That separation is the point, so the two
URLs are not interchangeable.

Render generates `APP_DB_PASSWORD` for you. Take the `Internal Database URL`
it shows for `fable5-db` and swap the credentials for the app role:

```
postgres://fable5_app:<APP_DB_PASSWORD>@<internal-host>/<database>
```

Copy `APP_DB_PASSWORD` from the service's Environment tab after the first
deploy attempt, paste the assembled URL into `DATABASE_URL`, and redeploy.

> **Why not automatic:** Render cannot interpolate one secret into another
> variable. This is the one manual step, and it is deliberate — it is also the
> moment the app credential stops being the default committed in this repo.

---

## 2 — Create the founder account

Migrations run automatically on every deploy (`start:deploy` runs
`migrate` then `server`, and migrations are idempotent and transactional).
Bootstrapping the founder is a **one-time, explicit** step — the system does
not invent an owner for you.

In Render → your service → **Shell**:

```bash
npm run bootstrap
```

This creates the tenant, the founder user, and the nine resource pools. It is
safe to re-run; it upserts.

Optionally, to see the Company Genome workspace populated:

```bash
npm run seed:demo-genome
```

Deliberately **not** part of `bootstrap`: a real organisation starts with no
validated genome, and inventing one is exactly the fake progress this system
refuses.

---

## 3 — Point the front end at the API

In Vercel → project → **Settings → Environment Variables**:

```
VITE_API_BASE = https://<your-render-service>.onrender.com
```

Then **redeploy** the Vercel project. `VITE_API_BASE` is read at *build* time,
not at runtime — setting it without redeploying changes nothing.

---

## 4 — Verify

```bash
# API is up and its database is reachable (this fails closed if Postgres is down)
curl https://<your-render-service>.onrender.com/api/health

# CORS allows your front end
curl -s -D- -o/dev/null -H "Origin: https://fable-5-omega.vercel.app" \
  https://<your-render-service>.onrender.com/api/health | grep -i access-control-allow-origin
```

Then on the live site: submit founding access (should succeed, not 405), and
sign in with the bootstrap credentials.

---

## Refusals you should expect

These are guards, not bugs. Each one fails closed rather than running in an
unsafe configuration:

| Symptom | Meaning |
|---|---|
| `APP_DB_PASSWORD is required when NODE_ENV=production` | Refusing to leave the `fable5_app` role on the default password committed to this repository. |
| `APP_ORIGIN is required when NODE_ENV=production` | Refusing to accept requests from any origin. Name your front ends. |
| `startup_refused … ECONNREFUSED` | Postgres unreachable. The process exits 1 instead of serving a broken API. |
| Front end says *"No API is configured for this site"* | `VITE_API_BASE` was unset at build time, or the build predates setting it. Redeploy Vercel. |

---

## What was verified, and what was not

Verified in this environment, against a real PostgreSQL:

- Migrations run cleanly on a database **not** named `fable5` — the previous
  `GRANT CONNECT ON DATABASE fable5` was hardcoded and would have failed on
  every managed provider.
- `npm run start:deploy` (the container's exact command) with
  `NODE_ENV=production`: migrations apply, the `fable5_app` password rotates to
  `APP_DB_PASSWORD`, the server boots, `/api/health` returns 200.
- Password rotation survives quotes and special characters in the secret.
- CORS: an allowed origin receives `Access-Control-Allow-Origin`; a foreign
  origin receives none.
- Both production guards refuse to boot, exit code 1.
- Full suites still green: 29/29 `scale-v2`, 52/52 `app`.

**Not verified here:** the Docker image build itself. This environment has the
Docker CLI but no daemon, so `docker build` could not run. The Dockerfile is
straightforward (`node:22-slim`, `npm ci --omit=dev`, copy source, non-root
user) and the command it runs is the one tested above — but the first Render
build is the first time the image is actually assembled. Watch that build log.
