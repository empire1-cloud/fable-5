# FABLE-5 control plane (scale-v2).
#
# Runs the real Express server — the same code the test suite covers — rather
# than a reimplementation for a serverless runtime, so what ships is what is
# tested.

FROM node:22-slim AS base
ENV NODE_ENV=production

WORKDIR /app

# Dependencies first, so a code change does not re-resolve the tree.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY public ./public

# Run unprivileged. The node image ships a `node` user; own the tree so the
# process can read it without being able to rewrite the image.
RUN chown -R node:node /app
USER node

EXPOSE 3001

# The platform injects PORT; server.js already honours it and falls back to
# 3001. Health lives at /api/health and fails closed when Postgres is
# unreachable, which is what a platform health check should key on.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Migrations are idempotent and transactional, so running them on boot is
# safe and keeps a deploy from silently serving an out-of-date schema.
CMD ["npm", "run", "start:deploy"]
