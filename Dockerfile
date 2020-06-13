FROM node:12.18-alpine3.12
# Should be ffmpeg v4.2.3
RUN apk add --no-cache ffmpeg && ffmpeg -version
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install -g browserify
RUN npm run build
EXPOSE 8000
CMD [ "npm", "start"]
