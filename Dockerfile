# Writ on Google Cloud Run. Build: docker build --build-arg NEXT_PUBLIC_PAYPAL_CLIENT_ID=… -t IMAGE .
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public PayPal client ID, inlined into the browser bundle at build time (it is not a secret).
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ENV NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/package.json /app/next.config.js ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
EXPOSE 8080
# Apply migrations, then serve on Cloud Run's $PORT.
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-8080}"]
