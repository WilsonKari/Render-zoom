# Speech-to-Text App

Aplicación web para convertir videos a texto utilizando Google Cloud Speech-to-Text API.

## Configuración del Proyecto

### Backend (Node.js + TypeScript + Express)

1. **Instalar dependencias**
```bash
cd backend
npm install
```

2. **Configuración de variables de entorno**
Crear un archivo `.env` en la carpeta `backend` con las siguientes variables:
```
PORT=8080
GOOGLE_APPLICATION_CREDENTIALS=gen-lang-client-0961962132-c17aa42ced24.json
GOOGLE_STORAGE_BUCKET=speech-to-text-app-bucket-123
SPEECH_TO_TEXT_LANGUAGE=es-ES
SPEECH_TO_TEXT_MODEL=latest_long
SPEECH_TO_TEXT_SAMPLE_RATE=16000
```

3. **Compilar y ejecutar**
```bash
npm run build
npm start
```

Para desarrollo con recarga automática:
```bash
npm run dev
```

### Frontend (Next.js + TypeScript)

1. **Instalar dependencias**
```bash
cd frontend
npm install
```

2. **Ejecutar en modo desarrollo**
```bash
npm run dev
```

## Características

- Conversión de video a FLAC optimizado para Speech-to-Text
- Soporte para videos largos (más de 1 minuto)
- Interfaz web moderna y responsiva
- Procesamiento asíncrono de videos
- Sanitización de nombres de archivo
- Manejo de errores robusto

## Requisitos

- Node.js 18 o superior
- Cuenta de Google Cloud con Speech-to-Text API habilitada
- Archivo de credenciales de Google Cloud

## Uso

1. Acceder a la aplicación web a través de http://localhost:3000
2. Subir un archivo de video
3. Esperar el procesamiento
4. Visualizar el texto extraído del audio

## Tecnologías Utilizadas

### Backend
- Node.js con TypeScript
- Express.js
- FFmpeg para procesamiento de video
- Google Cloud Speech-to-Text API
- Multer para manejo de archivos

### Frontend
- Next.js 14
- TypeScript
- TailwindCSS
- Shadcn UI
- React Hook Form

## Licencia

MIT
