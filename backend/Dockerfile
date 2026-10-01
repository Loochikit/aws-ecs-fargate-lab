# ==============================================================================
# Dockerfile para Backend API (Node.js / Express)
# Diseñado para AWS ECS Fargate y Amazon ECR
# ==============================================================================
FROM node:20-alpine

# Definir directorio de trabajo
WORKDIR /app

# Establecer entorno a producción
ENV NODE_ENV=production
ENV PORT=3000

# Copiar archivos de definición de paquetes primero para optimizar caché de capas Docker
COPY package*.json ./

# Instalar únicamente dependencias de producción
RUN npm install --omit=dev --ignore-scripts

# Copiar el código fuente de la aplicación
COPY . .

# Usar el usuario sin privilegios 'node' por seguridad en contenedores
USER node

# Exponer el puerto del servicio Backend
EXPOSE 3000

# Comando de ejecución
CMD ["node", "server.js"]
