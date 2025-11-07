# Start with a Node.js base image on Debian Bullseye
FROM node:20-bullseye

# Accept build-time args
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY

# Set them as env so Next.js build can see them
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY

# Install basic system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    git \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic link for Python
RUN ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Create and set ownership for the scripts directory
RUN mkdir -p /app/scripts && chown -R node:node /app/scripts

# Install Node.js dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install

# Install Python dependencies
COPY requirements.txt ./
RUN python -m pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Build the Next.js application
RUN pnpm run build

EXPOSE 3000
CMD ["pnpm", "start"]