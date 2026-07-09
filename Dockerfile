# Backend runtime image. Serves BOTH the API and the pre-built Angular dashboard
# from a single origin (http://<host>:4000).
#
# The dashboard is built locally (or in CI) BEFORE this image builds — this
# image does not run `ng build` itself. Angular's production build is
# CPU/RAM-heavy, and compiling it inside Docker on a small VM (e.g. a free-tier
# t3.micro) can starve the host badly enough to make SSH itself unresponsive.
# Building once on a real machine and shipping the static output keeps this
# image's build fast and light everywhere, not just on constrained hosts.
#
# Before building this image, run:  cd dashboard && npm ci && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
# Backend source + the sibling folders it reads at runtime (shared types,
# schema.sql, OpenAPI spec) must keep their relative layout.
COPY backend/ ./
COPY shared/ /app/shared/
COPY infra/ /app/infra/
COPY docs/ /app/docs/
# The already-built dashboard, served as static files by the backend.
COPY dashboard/dist/dashboard/browser /app/dashboard/dist/dashboard/browser

ENV NODE_ENV=production
ENV PORT=4000
ENV STATIC_DIR=/app/dashboard/dist/dashboard/browser
EXPOSE 4000
CMD ["npm", "start"]
