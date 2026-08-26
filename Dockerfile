# ============================================================================
# whiteboard-collaboration-service — distroless runtime image
#
# workspace#036-distroless-wave-1 (epic alkem-io/infrastructure-operations#2499)
#
# Both stages are pinned by DIGEST. Every digest below is a top-level
# MANIFEST-LIST (OCI image index) digest, NOT a per-architecture child digest.
# `build-release-docker-hub.yml` builds linux/amd64,linux/arm64 — a child
# digest would pin the build to a single architecture and break the arm64 leg.
# Re-verify with: docker buildx imagetools inspect <ref>
#   -> MediaType must be application/vnd.oci.image.index.v1+json, and the
#      manifest list must include linux/amd64 AND linux/arm64.
#
# NOTE FOR FUTURE READERS — DO NOT "HARMONISE" THIS FILE WITH
# notifications / collaborative-document-service.
# This repo is the one service in the wave whose Volta pin (22.23.1) has a
# matching `node:<version>-trixie-slim` builder published, so builder and
# runtime share the same Debian generation (trixie / Debian 13) and therefore
# the same glibc. notifications and collaborative-document-service pin Node
# versions for which no matched trixie builder exists and must keep a bookworm
# builder against a trixie runtime (plan.md §2.3). That mismatch is deliberate
# there; this match is deliberate here.
#
# Pins resolved 2026-08-05 (both verified as OCI indexes, amd64 + arm64):
#   node:22.23.1-trixie-slim                     sha256:e6d9a389d34f…
#   gcr.io/distroless/nodejs22-debian13:nonroot  sha256:939d6f167152…
# ============================================================================

# ======================
# Builder stage (dev deps)
# ======================
FROM node:22.23.2-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 AS builder

WORKDIR /app

# Dependency manifests
COPY package*.json ./

# Deterministic install (includes dev deps)
RUN npm ci

# Build inputs
COPY tsconfig*.json ./
COPY src ./src
COPY config.yml .

# Build TypeScript → dist
RUN npm run build


# ======================
# Prod deps stage (NO dev deps)
# ======================
FROM node:22.23.2-trixie-slim@sha256:7b8a0c89c54499bee567618f96578e1a12a800f062fbdbfd1fb6a443fa6f6284 AS prod-deps

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev \
 && npm cache clean --force


# ======================
# Runtime stage (distroless)
# ======================
FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:22d2f0480e59548ad14cf10d8921b24ef809780e7a61b162838f3d15a4a92e3d

WORKDIR /app

ENV NODE_ENV=production

# Copy only what is needed at runtime
# The hardcoded UID/GID 65532:65532 corresponds to the 'nonroot' user in the distroless image
COPY --from=prod-deps --chown=65532:65532 /app/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /app/dist ./dist
COPY --from=builder --chown=65532:65532 /app/config.yml ./config.yml
COPY --from=builder --chown=65532:65532 /app/package.json ./package.json

# Distroless runs as non-root by default
EXPOSE 4002

# No shell, direct execution
CMD ["dist/main.js"]
