FROM node:22-alpine
WORKDIR /app 
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_ENV=development
ENV PORT=3000
CMD ["npm","start"]
