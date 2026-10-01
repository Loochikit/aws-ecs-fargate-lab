# ==============================================================================
# Dockerfile para Frontend Web (Nginx + HTML/JS/CSS)
# Diseñado para AWS ECS Fargate y Amazon ECR (Subred Pública)
# Incluye Reverse Proxy hacia el Backend privado
# ==============================================================================
FROM nginx:alpine

# Variables de entorno por defecto (sobrescribibles en ECS o Docker Compose)
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3000

# Copiar la plantilla de configuración de Nginx
# La imagen oficial de Nginx procesa automáticamente plantillas en /etc/nginx/templates/*.template
# usando 'envsubst' al arrancar el contenedor.
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Copiar archivos estáticos de la interfaz web
COPY index.html /usr/share/nginx/html/index.html
COPY styles.css /usr/share/nginx/html/styles.css
COPY app.js /usr/share/nginx/html/app.js

# Exponer el puerto HTTP estándar
EXPOSE 80

# Comando para ejecutar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]
