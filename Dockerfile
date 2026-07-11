# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json* ./
COPY tsconfig.json ./

# Copy packages
COPY client ./client
COPY server ./server
COPY shared ./shared

# Install dependencies (will run postinstall/workspaces automatically)
RUN npm install

# Build everything
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy root configs
COPY --from=builder /app/package.json /app/package-lock.json* ./

# Copy built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/client/package.json ./client/package.json

# Environment
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
