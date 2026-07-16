FROM nginx:alpine

# Copiar configuraci�n de NGINX
COPY default.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos
COPY index.html /usr/share/nginx/html/
COPY app.js /usr/share/nginx/html/
COPY styles.css /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
