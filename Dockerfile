FROM node:12.16
RUN apt-get -y update && \
    apt-get -y upgrade && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /home/node/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm install -g browserify
RUN npm run build
EXPOSE 8000
CMD [ "npm", "start"]
