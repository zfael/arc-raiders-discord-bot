# Build stage - TypeScript compilation only
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for TypeScript)
RUN npm ci

# Copy source code (includes pre-generated maps in src/assets/generatedMaps)
COPY . .

# Build TypeScript and copy assets to dist/
# This runs: tsc && copyfiles assets/locales/templates to dist/
RUN npm run build

# Production stage - Runtime only
FROM node:24-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
# (no dev deps, no Puppeteer)
RUN npm ci --omit=dev

# Copy built application from builder
# This includes dist/assets/generatedMaps (copied by build script)
COPY --from=builder /app/dist ./dist

# Set timezone to UTC
ENV TZ=UTC

# Expose health check port
EXPOSE 6767

# Run the bot
CMD ["node", "dist/index.js"]