# Build and run ClinIQ as a single Node server. Not tested in this environment: try it locally first.
#   docker build -t cliniq \
#     --build-arg VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-KEY .
#   docker run -p 3000:3000 --env-file .env.server cliniq
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Browser-side values are baked in at build time; they are public by design.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
USER node
CMD ["node", ".output/server/index.mjs"]
