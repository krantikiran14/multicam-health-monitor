# Simulator image. Build context is the REPO ROOT (see docker-compose.yml) so we
# can copy the shared camera model alongside the simulator source.
FROM node:20-alpine
WORKDIR /app/simulator
COPY simulator/package*.json ./
RUN npm ci
COPY simulator/ ./
COPY shared/ /app/shared/

ENV NODE_ENV=production
CMD ["npm", "start"]
