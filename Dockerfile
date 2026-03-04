# Use official Node 22.14.0 image

# Build stage
FROM node:22.14.0 AS builder
WORKDIR /app

# Only copy package files for install
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source and build
COPY . .
RUN yarn build

# Production stage
FROM node:22.14.0 AS runner
WORKDIR /app


# Only copy built output and production deps
COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/server.js ./server.js

EXPOSE 3000
CMD ["node", "server.js"]
