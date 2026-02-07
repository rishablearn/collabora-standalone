FROM node:20-alpine

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Copy templates directory
COPY templates/ ./templates/

# Create storage and logs directories
RUN mkdir -p /storage /app/logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app /storage

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/index.js"]
