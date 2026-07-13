# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root config files
COPY package*.json ./

# Copy workspace directories
COPY client ./client
COPY server ./server
COPY shared ./shared

# Install all dependencies
RUN npm install

# Build client and server
RUN cd client && npm run build
RUN cd server && npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/client/package.json ./client/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/shared ./shared

EXPOSE 3001

# The built server is at server/dist/index.js
CMD ["node", "server/dist/index.js"]
