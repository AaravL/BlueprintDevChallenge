# multi-stage build: build Vite app, serve with nginx
FROM node:18-alpine AS builder

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app
COPY package*.json ./
RUN npm install --include=dev --silent --no-audit --progress=false

COPY . .
RUN npx vite build

# nginx stage: serve static and proxy /api to backend
FROM nginx:stable-alpine
# copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# replace default nginx conf with proxy for /api
RUN rm /etc/nginx/conf.d/default.conf
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location /api/ {\n\
        # preserve the full original URI so /api/v1/... forwards to http://host.docker.internal:8000/api/v1/...\n\
        proxy_pass http://host.docker.internal:8000;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto $scheme;\n\
    }\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]