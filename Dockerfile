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

# Install runtime dependencies (ffmpeg for HLS encoding)
RUN apk add --no-cache ffmpeg

# Copy node_modules and source
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src
## No SQLite file needed; using MySQL

# Entrypoint wrapper to optionally run the encoder before starting the API
COPY ./entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Expose port (Coolify may override via PORT env)
EXPOSE 3000

# Healthcheck using Node's global fetch (Node 20) - uses PORT env or defaults to 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;fetch('http://127.0.0.1:'+p+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start server (entrypoint runs optional encode first)
ENTRYPOINT ["./entrypoint.sh"]
