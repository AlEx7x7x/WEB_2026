FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000 9229
CMD ["node", "main.js", "-h", "0.0.0.0", "-p", "3000", "-c", "/app/cache"]