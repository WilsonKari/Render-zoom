import { config as dotenvConfig } from 'dotenv';
import * as os from 'os';
import * as path from 'path';

dotenvConfig();

// Determinar si estamos en Render
const isRender = process.env.RENDER === 'true';

// Configurar directorios basados en el entorno
const tmpDir = isRender 
    ? path.join(process.cwd(), 'tmp') // En Render, usar un directorio en el proyecto
    : path.join(os.tmpdir(), 'speech-to-text-temp'); // En desarrollo, usar temp del sistema

const uploadsDir = isRender
    ? path.join(process.cwd(), 'uploads') // En Render, usar un directorio en el proyecto
    : path.join(process.cwd(), 'uploads'); // En desarrollo, igual

// Constantes para límites
const GB_IN_BYTES = 1024 * 1024 * 1024;
const HOURS_IN_MS = 60 * 60 * 1000;

export const config = {
    // Asegurarse de que el puerto sea un número y tenga un valor predeterminado razonable
    port: parseInt(process.env.PORT || '8080', 10),
    tempDir: process.env.TEMP_DIR || tmpDir,
    uploadsDir: process.env.UPLOADS_DIR || uploadsDir,
    isRender,
    useCloudStorage: isRender, // Usar Cloud Storage en Render
    allowedFileTypes: [
        'video/mp4', 
        'video/mpeg', 
        'video/quicktime',
        'audio/mpeg',  // MP3
        'audio/ogg',   // OGG
        'audio/wav',   // WAV
        'audio/x-wav'  // WAV alternativo
    ],
    maxFileSize: 2 * GB_IN_BYTES, // 2GB
    maxVideoDuration: 3 * HOURS_IN_MS, // 3 horas en milisegundos
    google: {
        storageBucket: process.env.GOOGLE_STORAGE_BUCKET || 'speech-to-text-app-bucket-123',
        tempFolder: 'temp-files', // Carpeta en Cloud Storage para archivos temporales
        speechToText: {
            encoding: 'FLAC',
            sampleRateHertz: parseInt(process.env.SPEECH_TO_TEXT_SAMPLE_RATE || '16000'),
            languageCode: process.env.SPEECH_TO_TEXT_LANGUAGE || 'es-ES',
            enableAutomaticPunctuation: true,
            model: process.env.SPEECH_TO_TEXT_MODEL || 'latest_long'
        }
    }
};