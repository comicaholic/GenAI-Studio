# frontend/Dockerfile

# Stage 1: build
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
# If you use env vars in Vite, set VITE_* here or via docker-compose
RUN npm run build

# Stage 2: serve static build
FROM node:20
WORKDIR /app
RUN npm i -g serve
COPY --from=build /app/dist ./dist
EXPOSE 5173
CMD ["serve", "-s", "dist", "-l", "5173"]
