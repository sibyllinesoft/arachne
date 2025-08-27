# Multi-stage Dockerfile for ArachneJS Deobfuscator
# Supports hermetic builds with Z3, QuickJS, and all dependencies

# Stage 1: Build environment with system dependencies
FROM node:22-alpine AS system-deps

# Install system dependencies for native modules and Z3
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    build-base \
    cmake \
    git \
    bash \
    curl \
    z3 \
    z3-dev \
    gcc \
    g++ \
    make \
    libc6-compat

# Set Python alias for cross-platform compatibility
RUN ln -sf python3 /usr/bin/python

# Stage 2: Python dependencies
FROM system-deps AS python-deps

WORKDIR /app

# Copy and install Python requirements
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Verify Z3 installation
RUN python3 -c "import z3; print(f'Z3 version: {z3.get_version_string()}')"

# Stage 3: Node.js dependencies
FROM python-deps AS node-deps

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Install development dependencies for build
COPY package.json ./
RUN npm ci

# Stage 4: Build application
FROM node-deps AS builder

# Copy source code
COPY src/ ./src/
COPY tests/ ./tests/

# Build TypeScript
RUN npm run build

# Run type checking and linting
RUN npm run type-check
RUN npm run lint

# Stage 5: Test stage (optional, can be skipped in production builds)
FROM builder AS tester

# Copy test configuration
COPY .strykerrc.json ./
COPY playwright.config.ts ./

# Run tests (this stage can be skipped with --target production)
RUN npm test -- --run
RUN npm run test:coverage

# Stage 6: Production runtime
FROM node:22-alpine AS production

# Install minimal runtime dependencies
RUN apk add --no-cache \
    python3 \
    z3 \
    bash \
    curl

# Create non-root user
RUN addgroup -g 1001 -S arachne && \
    adduser -S arachne -u 1001 -G arachne

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=node-deps /app/node_modules ./node_modules
COPY --from=python-deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy runtime configuration
COPY package.json ./
COPY scripts/ ./scripts/
COPY artifacts/ ./artifacts/

# Create necessary directories with correct permissions
RUN mkdir -p logs analysis/output && \
    chown -R arachne:arachne /app

# Switch to non-root user
USER arachne

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node dist/cli/index.js --version || exit 1

# Default command
ENTRYPOINT ["node", "dist/cli/index.js"]
CMD ["--help"]

# Development stage
FROM builder AS development

# Install additional development tools
RUN npm install -g nodemon tsx

# Copy all development files
COPY . .

# Create development user
USER root
RUN addgroup -g 1001 -S arachne && \
    adduser -S arachne -u 1001 -G arachne && \
    chown -R arachne:arachne /app

USER arachne

# Development command
CMD ["npm", "run", "dev"]

# Labels for metadata
LABEL org.opencontainers.image.title="ArachneJS Deobfuscator"
LABEL org.opencontainers.image.description="Advanced JavaScript deobfuscation tool"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.source="https://github.com/arachnejs/deobfuscator"