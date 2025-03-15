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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const storage_service_1 = require("./storage.service");
const speech_1 = require("@google-cloud/speech");
const dotenv_1 = require("dotenv");
const fsSync = __importStar(require("fs"));
// Cargar variables de entorno
(0, dotenv_1.config)();
class AudioService {
    static async initialize() {
        try {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está definida');
            }
            const credentialsPath = path_1.default.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
            // Verificar que el archivo existe
            if (!fsSync.existsSync(credentialsPath)) {
                throw new Error(`El archivo de credenciales no existe en la ruta: ${credentialsPath}`);
            }
            console.log('✅ Speech Service usando archivo de credenciales:', credentialsPath);
            this.speechClient = new speech_1.SpeechClient({ keyFilename: credentialsPath });
            console.log('✅ Speech Service inicializado correctamente');
        }
        catch (error) {
            console.error('❌ Error inicializando Speech Service:', error);
            throw error;
        }
    }
    /**
     * Procesa un archivo de audio y lo transcribe a texto
     * @param audioPath Ruta del archivo de audio (local o gs://)
     * @returns Objeto con la transcripción y el URI del archivo en Cloud Storage
     */
    static async processAndTranscribeAudio(audioPath) {
        var _a;
        if (!this.speechClient) {
            await this.initialize();
        }
        let gcsUri = audioPath;
        let needsCleanup = false;
        try {
            console.log('\n=== Iniciando proceso de audio y transcripción ===');
            console.log(`Archivo de entrada: ${audioPath}`);
            // Si no es una ruta de GCS, subir el archivo
            if (!audioPath.startsWith('gs://')) {
                // Verificar que el archivo existe y obtener su tamaño
                const stats = await fs_1.promises.stat(audioPath);
                const fileSizeMB = stats.size / 1024 / 1024;
                console.log(`\n📊 Tamaño del archivo: ${fileSizeMB.toFixed(2)} MB`);
                if (stats.size === 0) {
                    throw new Error('El archivo está vacío');
                }
                // Subir archivo a Google Cloud Storage
                console.log('\n🌐 Subiendo archivo a Google Cloud Storage...');
                gcsUri = await storage_service_1.StorageService.uploadFile(audioPath);
                needsCleanup = true;
                console.log(`✅ Archivo subido a: ${gcsUri}`);
            }
            // Configurar la solicitud de transcripción
            const request = {
                audio: {
                    uri: gcsUri,
                },
                config: {
                    encoding: speech_1.protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
                    sampleRateHertz: config_1.config.google.speechToText.sampleRateHertz,
                    languageCode: config_1.config.google.speechToText.languageCode,
                    enableAutomaticPunctuation: true,
                    model: 'latest_long',
                    useEnhanced: true
                }
            };
            // Realizar la transcripción usando longRunningRecognize
            console.log('\n🎙️ Iniciando transcripción de audio (operación larga)...');
            const [operation] = await this.speechClient.longRunningRecognize(request);
            console.log('⏳ Esperando resultados...');
            // Monitorear el progreso
            operation.on('progress', (metadata) => {
                if (metadata && metadata.progressPercent) {
                    console.log(`Progreso: ${metadata.progressPercent}%`);
                }
            });
            // Esperar a que la operación se complete
            const [response] = await operation.promise();
            // Unir las transcripciones con espacio en lugar de salto de línea
            const transcription = ((_a = response.results) === null || _a === void 0 ? void 0 : _a.map(result => { var _a, _b; return ((_b = (_a = result.alternatives) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.transcript) || ''; }).join(' ')) || '';
            console.log('\n=== Resultado de la transcripción ===');
            console.log('✅ Transcripción completada.');
            console.log('\nTexto transcrito:');
            console.log('----------------------------------------');
            console.log(transcription || 'No se pudo extraer texto del audio');
            console.log('----------------------------------------\n');
            // Si el archivo era local, limpiarlo
            if (!audioPath.startsWith('gs://')) {
                try {
                    await fs_1.promises.unlink(audioPath);
                    console.log('🗑️ Archivo temporal local eliminado');
                }
                catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo temporal:', err);
                }
            }
            // Si necesitamos limpiar el archivo de GCS (lo subimos nosotros)
            if (needsCleanup) {
                try {
                    const fileName = gcsUri.split('/').pop();
                    if (fileName) {
                        await storage_service_1.StorageService.deleteFile(fileName);
                        console.log('🗑️ Archivo de audio eliminado de Cloud Storage');
                    }
                }
                catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo de Cloud Storage:', err);
                }
            }
            return {
                transcription: transcription.length > 0 ? transcription : "No se pudo extraer texto del audio",
                gcsUri: gcsUri
            };
        }
        catch (error) {
            console.error('\n❌ Error en el procesamiento de audio:', error);
            if (error instanceof Error) {
                console.error('Detalles del error:', error.stack);
            }
            // Intentar limpiar en caso de error si subimos el archivo
            if (needsCleanup && gcsUri.startsWith('gs://')) {
                try {
                    const fileName = gcsUri.split('/').pop();
                    if (fileName) {
                        await storage_service_1.StorageService.deleteFile(fileName);
                    }
                }
                catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo de Cloud Storage durante la limpieza de error:', err);
                }
            }
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            throw new Error(`Error al procesar el audio: ${errorMessage}`);
        }
    }
}
exports.AudioService = AudioService;
