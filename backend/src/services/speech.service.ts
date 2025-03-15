import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/config';
import { FFmpegService } from '../utils/ffmpeg';
import { StorageService } from './storage.service';
import { SpeechClient, protos } from '@google-cloud/speech';
import { config as dotenvConfig } from 'dotenv';
import * as fsSync from 'fs';

// Cargar variables de entorno
dotenvConfig();

export class AudioService {
    private static speechClient: SpeechClient;

    static async initialize() {
        try {
            if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
                throw new Error('La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está definida');
            }

            const credentialsPath = path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);
            
            // Verificar que el archivo existe
            if (!fsSync.existsSync(credentialsPath)) {
                throw new Error(`El archivo de credenciales no existe en la ruta: ${credentialsPath}`);
            }
            
            console.log('✅ Speech Service usando archivo de credenciales:', credentialsPath);
            
            this.speechClient = new SpeechClient({ keyFilename: credentialsPath });
            console.log('✅ Speech Service inicializado correctamente');
        } catch (error) {
            console.error('❌ Error inicializando Speech Service:', error);
            throw error;
        }
    }

    /**
     * Procesa un archivo de audio y lo transcribe a texto
     * @param audioPath Ruta del archivo de audio (local o gs://)
     * @returns Objeto con la transcripción y el URI del archivo en Cloud Storage
     */
    static async processAndTranscribeAudio(audioPath: string): Promise<{
        transcription: string;
        gcsUri: string;
    }> {
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
                const stats = await fs.stat(audioPath);
                const fileSizeMB = stats.size / 1024 / 1024;
                console.log(`\n📊 Tamaño del archivo: ${fileSizeMB.toFixed(2)} MB`);

                if (stats.size === 0) {
                    throw new Error('El archivo está vacío');
                }

                // Subir archivo a Google Cloud Storage
                console.log('\n🌐 Subiendo archivo a Google Cloud Storage...');
                gcsUri = await StorageService.uploadFile(audioPath);
                needsCleanup = true;
                console.log(`✅ Archivo subido a: ${gcsUri}`);
            }

            // Configurar la solicitud de transcripción
            const request = {
                audio: {
                    uri: gcsUri,
                },
                config: {
                    encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding.LINEAR16,
                    sampleRateHertz: config.google.speechToText.sampleRateHertz,
                    languageCode: config.google.speechToText.languageCode,
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
            operation.on('progress', (metadata: any) => {
                if (metadata && metadata.progressPercent) {
                    console.log(`Progreso: ${metadata.progressPercent}%`);
                }
            });
            
            // Esperar a que la operación se complete
            const [response] = await operation.promise();
            
            // Unir las transcripciones con espacio en lugar de salto de línea
            const transcription = response.results
                ?.map(result => result.alternatives?.[0]?.transcript || '')
                .join(' ') || '';
                
            console.log('\n=== Resultado de la transcripción ===');
            console.log('✅ Transcripción completada.');
            console.log('\nTexto transcrito:');
            console.log('----------------------------------------');
            console.log(transcription || 'No se pudo extraer texto del audio');
            console.log('----------------------------------------\n');

            // Si el archivo era local, limpiarlo
            if (!audioPath.startsWith('gs://')) {
                try {
                    await fs.unlink(audioPath);
                    console.log('🗑️ Archivo temporal local eliminado');
                } catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo temporal:', err);
                }
            }

            // Si necesitamos limpiar el archivo de GCS (lo subimos nosotros)
            if (needsCleanup) {
                try {
                    const fileName = gcsUri.split('/').pop();
                    if (fileName) {
                        await StorageService.deleteFile(fileName);
                        console.log('🗑️ Archivo de audio eliminado de Cloud Storage');
                    }
                } catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo de Cloud Storage:', err);
                }
            }

            return {
                transcription: transcription.length > 0 ? transcription : "No se pudo extraer texto del audio",
                gcsUri: gcsUri
            };
        } catch (error: unknown) {
            console.error('\n❌ Error en el procesamiento de audio:', error);
            if (error instanceof Error) {
                console.error('Detalles del error:', error.stack);
            }

            // Intentar limpiar en caso de error si subimos el archivo
            if (needsCleanup && gcsUri.startsWith('gs://')) {
                try {
                    const fileName = gcsUri.split('/').pop();
                    if (fileName) {
                        await StorageService.deleteFile(fileName);
                    }
                } catch (err) {
                    console.warn('⚠️ No se pudo eliminar el archivo de Cloud Storage durante la limpieza de error:', err);
                }
            }

            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            throw new Error(`Error al procesar el audio: ${errorMessage}`);
        }
    }
}