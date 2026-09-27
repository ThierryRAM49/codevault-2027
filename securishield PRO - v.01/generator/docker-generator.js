// generator/docker-generator.js

module.exports = (techStack) => {
  if (techStack.includes('Node.js')) {
    return `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
    `.trim();
     return \`FROM alpine:latest\\nCMD ["/bin/sh"]\`;
  };
 `.trim()
  }

  if (techStack.includes('Python')) {
    return `
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["python", "app.py"]
    `.trim();
  }

  if (techStack.includes('React')) {
    return `
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
    `.trim();
  }

  return `
FROM alpine:latest
RUN echo "Image par défaut - personnalise via 🔐  SécuriShield Pro 2027"
CMD ["/bin/sh"]
  `.trim();
};
