# Usar la imagen oficial de Playwright que coincida con la versión de la dependencia
FROM mcr.microsoft.com/playwright:v1.51.0-jammy

WORKDIR /app

# Instalación de FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Crear los directorios temporales y de subida con permisos correctos
# Usamos nombres de directorios similares a los configurados en config.ts
RUN mkdir -p /app/tmp /app/temp /app/uploads \
    && chmod -R 777 /app/tmp /app/temp /app/uploads \
    && echo "Directorios temporales creados correctamente" \
    && ls -la /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Copiar el archivo de credenciales de Google Cloud
COPY gen-lang-client-0961962132-cac0a78b50b5.json ./

# Instalar dependencias de Node.js
RUN npm ci

# Copiar el código fuente
COPY . .

# Asegurarse de que los directorios temporales existan y tengan permisos correctos
# (pueden haber sido sobrescritos por COPY)
RUN mkdir -p /app/tmp /app/temp /app/uploads \
    && chmod -R 777 /app/tmp /app/temp /app/uploads \
    && echo "Re-verificando directorios temporales" \
    && ls -la /app \
    && touch /app/tmp/.keep /app/temp/.keep /app/uploads/.keep

# Compilar TypeScript a JavaScript
RUN npm run build

# Verificar que los directorios temporales existen después de la compilación
RUN ls -la /app/tmp /app/temp /app/uploads \
    && echo "Directorios temporales después de compilar:"

# Crear un script auxiliar para asegurar permisos y directorios en tiempo de ejecución
RUN echo '#!/bin/bash' > /app/ensure-dirs.sh \
    && echo 'mkdir -p /app/tmp /app/temp /app/uploads' >> /app/ensure-dirs.sh \
    && echo 'chmod -R 777 /app/tmp /app/temp /app/uploads' >> /app/ensure-dirs.sh \
    && echo 'echo "Directorios temporales verificados al inicio:"' >> /app/ensure-dirs.sh \
    && echo 'ls -la /app/tmp /app/temp /app/uploads' >> /app/ensure-dirs.sh \
    && echo 'exec "$@"' >> /app/ensure-dirs.sh \
    && chmod +x /app/ensure-dirs.sh

# Configurar variables de entorno para la aplicación
ENV NODE_ENV=production
ENV RENDER=true

# Configurar explicitamente ambos directorios temporales para mayor seguridad
ENV TEMP_DIR=/app/tmp
ENV TEMP_DIRECTORY=/app/temp
ENV UPLOADS_DIR=/app/uploads

# Configuración para Playwright - Esta es la clave para resolver el problema
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Configurar variables de entorno adicionales
ENV PORT=8080
ENV HOST=0.0.0.0
ENV GOOGLE_STORAGE_BUCKET=speech-to-text-app-bucket-123
ENV SPEECH_TO_TEXT_LANGUAGE=es-ES
ENV SPEECH_TO_TEXT_MODEL=latest_long
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/gen-lang-client-0961962132-cac0a78b50b5.json

# Exponer el puerto que usará Cloud Run
EXPOSE 8080

# Usar el script auxiliar como punto de entrada
ENTRYPOINT ["/app/ensure-dirs.sh"]

# Comando para iniciar la aplicación
CMD ["npm", "start"]
