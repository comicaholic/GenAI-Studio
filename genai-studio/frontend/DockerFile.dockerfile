# frontend/DockerFile.dockerfile

# Stage 1: build
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .

# >>> allow injecting VITE_* at build time
ARG VITE_API_BASE
ENV VITE_API_BASE=${VITE_API_BASE}

RUN npm run build

# Stage 2: serve static build with nginx proxy
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
