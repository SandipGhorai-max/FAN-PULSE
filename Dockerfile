# Stage 1: Build the Vite React Frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy all frontend files and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Setup the Backend & Serve
FROM node:20-alpine
WORKDIR /app

# Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./
# Install only production dependencies
RUN npm install --omit=dev

# Copy backend files
COPY backend/ ./

# Copy the built frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Expose the backend port
EXPOSE 3001

# Set production environment variable
ENV NODE_ENV=production
ENV PORT=3001

# Ensure db directory has proper permissions in case we use SQLite
# RUN mkdir -p /app/backend/db && chown -R node:node /app/backend/db

# Use non-root user for security
# USER node

# Start the application
CMD ["npm", "start"]
