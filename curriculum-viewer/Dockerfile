# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Build arguments for Vite environment variables
ARG VITE_API_URL=https://calculatemath-production.up.railway.app/api
ARG VITE_SKILL_TREE_MODE

# Set environment variables for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SKILL_TREE_MODE=$VITE_SKILL_TREE_MODE

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
