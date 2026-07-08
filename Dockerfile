# Multi-stage build for the web application: build the Angular dashboard, then
# run the Express backend which serves BOTH the API and that built dashboard
# from a single origin (http://<host>:4000).

# ---- Stage 1: build the Angular dashboard ----
FROM node:20-alpine AS dashboard-build
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# ---- Stage 2: backend runtime (also serves the dashboard) ----
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
# The built dashboard, served as static files by the backend.
COPY --from=dashboard-build /app/dashboard/dist/dashboard/browser /app/dashboard/dist/dashboard/browser

ENV NODE_ENV=production
ENV PORT=4000
ENV STATIC_DIR=/app/dashboard/dist/dashboard/browser
EXPOSE 4000
CMD ["npm", "start"]
