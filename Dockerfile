# Use official Node 22.14.0 image
FROM node:22.14.0

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy all source code
COPY . .

# Build Next.js app
RUN yarn build

# Expose port (Railway sets $PORT)
EXPOSE 3000

# Start server
CMD ["yarn", "start"]
