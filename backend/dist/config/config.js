"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = require("dotenv");
const os = __importStar(require("os"));
const path = __importStar(require("path"));
(0, dotenv_1.config)();
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
exports.config = {
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
        'audio/mpeg', // MP3
        'audio/ogg', // OGG
        'audio/wav', // WAV
        'audio/x-wav' // WAV alternativo
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
