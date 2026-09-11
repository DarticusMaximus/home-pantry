FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APPWRITE_ENDPOINT=https://appwrite.placeholder.invalid/v1
ENV NEXT_PUBLIC_APPWRITE_PROJECT_ID=placeholder-project-id
RUN corepack enable && pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --chown=node:node docker-entrypoint.mjs ./docker-entrypoint.mjs
USER node
EXPOSE 3000
ENTRYPOINT ["node", "docker-entrypoint.mjs"]
