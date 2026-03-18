FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL=https://calculatemath-production.up.railway.app/api
ARG VITE_SKILL_TREE_MODE

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SKILL_TREE_MODE=$VITE_SKILL_TREE_MODE

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
