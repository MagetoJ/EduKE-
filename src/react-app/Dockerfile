# /src/react-app/Dockerfile

# Stage 1: Build the React code
FROM node:20-alpine AS build
WORKDIR /app

# Enable pnpm via corepack (bundled with Node 20)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files (including the lockfile) and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the code and build the project
COPY . .
RUN pnpm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]