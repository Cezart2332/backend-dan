# Multi-stage Dockerfile for Coolify (Node.js + Better Auth)
# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first (better cache)
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev

# Copy source
COPY . .

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy node_modules and source
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src
## No SQLite file needed; using MySQL

# Expose port
EXPOSE 4000

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# Start server
CMD ["node", "src/index.js"]
