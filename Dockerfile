FROM node:22-bookworm-slim AS dependencies

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci


FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build \
  && npm prune --omit=dev


FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/media ./media

# Payload migrations load the TypeScript config and collection modules at runtime.
COPY --from=builder --chown=node:node /app/app ./app
COPY --from=builder --chown=node:node /app/components ./components
COPY --from=builder --chown=node:node /app/hooks ./hooks
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/migrations ./migrations
COPY --from=builder --chown=node:node /app/payload ./payload
COPY --from=builder --chown=node:node /app/providers ./providers
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/types ./types
COPY --from=builder --chown=node:node /app/next.config.ts /app/payload.config.ts /app/payload.migrations.config.ts /app/payload-types.ts /app/tsconfig.json ./

USER node
EXPOSE 3000

CMD ["npm", "run", "start"]
