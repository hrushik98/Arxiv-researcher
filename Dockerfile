# syntax=docker/dockerfile:1

##############################
# Stage 1 — build the Next.js frontend
##############################
FROM oven/bun:1 AS frontend-build

WORKDIR /app/frontend

# Install dependencies first (cached unless the lockfile changes)
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

# Build the production bundle
COPY frontend/ ./
RUN bun run build


##############################
# Stage 2 — runtime image with both Python (backend) and Bun (frontend)
##############################
FROM python:3.12-slim AS runtime

# uv (backend package manager) and bun (to run `next start`)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun

ENV PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/app/backend/.venv \
    NODE_ENV=production \
    BACKEND_PORT=8000 \
    FRONTEND_PORT=3000 \
    HOSTNAME=0.0.0.0

# --- Backend dependencies (cached unless lockfile changes) ---
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./

# --- Frontend artifacts from the build stage ---
WORKDIR /app/frontend
COPY --from=frontend-build /app/frontend/.next ./.next
COPY --from=frontend-build /app/frontend/node_modules ./node_modules
COPY --from=frontend-build /app/frontend/public ./public
COPY frontend/package.json frontend/next.config.ts ./

# --- Process supervisor: start backend + frontend, exit if either dies ---
WORKDIR /app
RUN cat > /app/start.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "Starting backend on :${BACKEND_PORT} ..."
( cd /app/backend && uv run --no-sync uvicorn main:app --host 0.0.0.0 --port "${BACKEND_PORT}" ) &
backend_pid=$!

echo "Starting frontend on :${FRONTEND_PORT} ..."
( cd /app/frontend && bun run start --hostname 0.0.0.0 --port "${FRONTEND_PORT}" ) &
frontend_pid=$!

# Forward termination signals to both children
trap 'kill -TERM "$backend_pid" "$frontend_pid" 2>/dev/null || true' TERM INT

# Exit as soon as either process exits, propagating its status
wait -n "$backend_pid" "$frontend_pid"
status=$?
kill -TERM "$backend_pid" "$frontend_pid" 2>/dev/null || true
exit $status
EOF
RUN chmod +x /app/start.sh

EXPOSE 3000 8000

CMD ["/app/start.sh"]
