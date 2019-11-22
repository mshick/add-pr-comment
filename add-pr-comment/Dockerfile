FROM node:slim

LABEL "com.github.actions.name"="Add PR Comment"
LABEL "com.github.actions.description"="Add a comment to the PR triggering this action"
LABEL "com.github.actions.icon"="send"
LABEL "com.github.actions.color"="gray-dark"

COPY package*.json ./

RUN npm ci

COPY . .

ENTRYPOINT ["node", "/entrypoint.js"]
