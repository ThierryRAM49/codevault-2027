FROM node:22-bookworm-slim

WORKDIR /var/www/html

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["sh", "-c", "npm run build && npm run start"]
