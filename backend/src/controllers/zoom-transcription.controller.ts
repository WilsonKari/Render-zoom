import { Request, Response } from 'express';
import { ZoomService } from '../services/zoom.service';
import { AudioConverter } from '../utils/audio-converter';
import { AudioService } from '../services/speech.service';
import { TaskService } from '../services/task.service';
import { StorageService } from '../services/storage.service';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config/config';

export class ZoomTranscriptionController {
    /**
     * Descarga un video de Zoom a partir de su URL y lo transcribe (versión asíncrona)
     * @param req Request con la URL de Zoom y parámetros opcionales
     * @param res Response con el ID de la tarea creada
     */
    static async transcribeZoom(req: Request, res: Response) {
        try {
            // Verificar que se proporciona una URL de Zoom
            const { zoom_url } = req.body;
            console.log('\n📹 Petición START: /api/zoom/transcribe');
            console.log('📝 Body recibido:', JSON.stringify(req.body));
            
            if (!zoom_url) {
                console.warn('❌ No se proporcionó URL de Zoom');
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                
                // Construir objeto de respuesta de error
                const errorResponse = { 
                    error: {
                        message: 'No se proporcionó ninguna URL de Zoom',
                        type: 'invalid_request_error'
                    }
                };
                
                console.log('🚨 Enviando respuesta de error:', JSON.stringify(errorResponse));
                return res.status(400).send(JSON.stringify(errorResponse));
            }

            // Obtener los parámetros opcionales
            const language = req.body.language || 'es';
            const responseFormat = req.body.response_format || 'json';
            
            console.log(`\n🎬 Iniciando procesamiento de video de Zoom`);
            console.log(`🔗 URL de Zoom: ${zoom_url}`);
            console.log(`🌐 Idioma: ${language}`);
            console.log(`📄 Formato de respuesta: ${responseFormat}`);

            // Crear directorio temporal si no existe
            if (!fs.existsSync(config.tempDir)) {
                fs.mkdirSync(config.tempDir, { recursive: true });
            }
            
            // Crear una nueva tarea y obtener su ID
            const taskId = TaskService.createTask({
                zoom_url,
                language,
                response_format: responseFormat
            });
            
            console.log(`\n📝 Tarea creada con ID: ${taskId}, preparando respuesta...`);
            
            // Construir objeto de respuesta exitosa
            const successResponse = {
                task_id: taskId,
                status: 'pending',
                message: 'Tarea de transcripción iniciada',
                check_progress_url: `/api/zoom/tasks/${taskId}`
            };
            
            // Configurar headers explícitos para evitar problemas de interpretación
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Connection', 'keep-alive');
            
            // Convertir a JSON
            const jsonResponse = JSON.stringify(successResponse);
            
            // Log detallado para debug
            console.log(`📝 RESPONDIENDO al cliente con:`, jsonResponse);
            console.log(`📝 Headers configurados:`, JSON.stringify({
                'Content-Type': res.getHeader('Content-Type'),
                'Cache-Control': res.getHeader('Cache-Control'),
                'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
                'Connection': res.getHeader('Connection')
            }));
            
            // ENFOQUE MÁS DIRECTO: Usar res.end() para asegurar que la respuesta se envíe
            res.writeHead(202);
            res.write(jsonResponse);
            res.end();
            
            console.log(`\n📝 Respuesta enviada con res.end(), iniciando procesamiento asíncrono...`);
            
            // Iniciar el proceso en segundo plano (DESPUÉS de enviar la respuesta)
            ZoomTranscriptionController.processZoomTranscription(taskId, zoom_url, language, responseFormat)
                .catch(error => {
                    console.error(`\n🚨 Error en procesamiento en segundo plano:`, error);
                    TaskService.updateTask(taskId, {
                        status: 'failed',
                        progress: 0,
                        message: 'Error interno del servidor',
                        error: error.message || 'Error desconocido'
                    });
                });
            
            // Retornar para finalizar el handler
            return;
            
        } catch (error: any) {
            console.error('\n❌ Error en el proceso de transcripción de Zoom:', error);
            
            // Mensaje de error detallado
            const errorMessage = error.message || 'Error desconocido';
            const errorDetails = error.stack ? `\n${error.stack}` : '';
            console.error(`Detalles del error: ${errorMessage}${errorDetails}`);
            
            // Configurar headers explícitos para Postman
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            // Construir objeto de respuesta de error
            const serverErrorResponse = {
                error: {
                    message: errorMessage,
                    type: 'server_error'
                }
            };
            
            console.log('🚨 Enviando respuesta de error de servidor:', JSON.stringify(serverErrorResponse));
            
            // Usar el enfoque directo también para errores
            res.writeHead(500);
            res.write(JSON.stringify(serverErrorResponse));
            res.end();
            return;
        }
    }
    
    /**
     * Obtiene el estado actual de una tarea de transcripción
     * @param req Request con el ID de la tarea
     * @param res Response con el estado actual
     */
    static async getTaskProgress(req: Request, res: Response) {
        try {
            // Obtener taskId de múltiples fuentes posibles (URL params, body, o headers)
            let taskId = req.params.taskId;
            
            // Si no hay taskId en params, intentar obtenerlo del body o headers
            if (!taskId) {
                if (req.body && req.body.task_id) {
                    taskId = req.body.task_id;
                } else if (req.headers['x-task-id']) {
                    taskId = req.headers['x-task-id'] as string;
                }
            }
            
            console.log(`👉 Consultando progreso de tarea con ID: ${taskId}`);            
            
            if (!taskId) {
                console.warn('❌ Solicitud sin ID de tarea');
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                
                return res.status(400).send(JSON.stringify({
                    error: {
                        message: 'Se requiere un ID de tarea',
                        type: 'invalid_request_error'
                    }
                }));
            }
            
            const task = TaskService.getTask(taskId);
            
            if (!task) {
                console.warn(`❌ Tarea no encontrada: ${taskId}`);
                // Configurar headers explícitos para Postman y otros clientes
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Access-Control-Allow-Origin', '*');
                
                return res.status(404).send(JSON.stringify({
                    error: {
                        message: 'Tarea no encontrada',
                        type: 'not_found_error'
                    }
                }));
            }
            
            // Calcular tiempo transcurrido
            const elapsedTime = Math.floor((new Date().getTime() - task.startTime.getTime()) / 1000);
            
            // Construir respuesta base
            const response: any = {
                task_id: task.id,
                status: task.status,
                progress: task.progress,
                message: task.message,
                elapsed_time_seconds: elapsedTime
            };
            
            // Incluir resultado si está completo
            if (task.status === 'completed' && task.result) {
                response.result = task.result;
            }
            
            // Incluir error si falló
            if (task.status === 'failed' && task.error) {
                response.error = task.error;
            }
            
            console.log(`✅ Enviando respuesta para tarea ${taskId}:`, JSON.stringify(response));
            
            // Configurar headers explícitos para evitar problemas de interpretación
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Connection', 'keep-alive');
            
            // Usar send en lugar de json para más control
            return res.status(200).send(JSON.stringify(response));
        } catch (error: any) {
            console.error('❌ Error al obtener progreso de la tarea:', error);
            
            // Mensaje de error detallado
            const errorMessage = error.message || 'Error interno del servidor';
            const errorDetails = error.stack ? `\n${error.stack}` : '';
            console.error(`Detalles del error: ${errorMessage}${errorDetails}`);
            
            // Configurar headers explícitos para Postman
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            return res.status(500).send(JSON.stringify({
                error: {
                    message: errorMessage,
                    type: 'server_error'
                }
            }));
        }
    }
    
    /**
     * Método privado para procesar la transcripción en segundo plano
     * @param taskId ID de la tarea
     * @param zoomUrl URL del video de Zoom
     * @param language Idioma para la transcripción
     * @param responseFormat Formato de respuesta (json o text)
     */
    private static async processZoomTranscription(taskId: string, zoomUrl: string, language = 'es', responseFormat = 'json') {
        const tempFiles = new Set<string>();
        const deletedFiles = new Set<string>();

        const safeDeleteFile = async (filePath: string) => {
            if (deletedFiles.has(filePath)) {
                return; // El archivo ya fue eliminado
            }

            try {
                if (filePath.startsWith('gs://')) {
                    // Extraer la ruta completa desde el bucket
                    const bucketName = config.google.storageBucket;
                    const fullPath = filePath.replace(`gs://${bucketName}/`, '');
                    
                    console.log(`Intentando eliminar archivo de Cloud Storage: ${fullPath}`);
                    if (fullPath) {
                        await StorageService.deleteFile(fullPath);
                        console.log(`🗑️ Archivo eliminado de Cloud Storage: ${fullPath}`);
                    }
                } else if (fs.existsSync(filePath)) {
                    await fs.promises.unlink(filePath);
                    console.log(`🗑️ Archivo local eliminado: ${filePath}`);
                }
                deletedFiles.add(filePath);
            } catch (error: any) { // Especificar el tipo como 'any' para acceder a .code
                // Solo logear el error si el archivo realmente existía
                if (error.code !== 'ENOENT') {
                    console.warn(`⚠️ No se pudo eliminar el archivo ${filePath}:`, error);
                }
            }
        };

        try {
            // Actualizar estado: validando URL
            TaskService.updateTask(taskId, {
                status: 'validating',
                progress: 5,
                message: 'Validando URL de Zoom'
            });
            
            // Validar URL
            const urlValidation = await ZoomService.validateZoomUrl(zoomUrl);
            if (!urlValidation.valid) {
                TaskService.updateTask(taskId, {
                    status: 'failed',
                    progress: 0,
                    message: 'URL de Zoom inválida',
                    error: urlValidation.message
                });
                return;
            }
            
            // Actualizar estado: descargando video
            TaskService.updateTask(taskId, {
                status: 'downloading',
                progress: 10,
                message: 'Descargando video de Zoom'
            });
            
            // Descargar video
            const downloadResult = await ZoomService.downloadZoomVideo(zoomUrl, config.tempDir);
            if (!downloadResult.success || !downloadResult.filePath) {
                TaskService.updateTask(taskId, {
                    status: 'failed',
                    progress: 0,
                    message: 'Error al descargar el video',
                    error: downloadResult.message
                });
                return;
            }

            tempFiles.add(downloadResult.filePath);
            
            // Actualizar estado: convirtiendo video
            TaskService.updateTask(taskId, {
                status: 'converting',
                progress: 50,
                message: 'Convirtiendo video a formato FLAC'
            });
            
            // Convertir video a FLAC - ahora recibe y devuelve rutas completas
            const audioPath = await AudioConverter.convertToFlac(downloadResult.filePath);
            tempFiles.add(audioPath);
            
            // Limpiar el archivo de video después de la conversión
            await safeDeleteFile(downloadResult.filePath);
            
            // Actualizar estado: transcribiendo audio
            TaskService.updateTask(taskId, {
                status: 'transcribing',
                progress: 75,
                message: 'Procesando audio y generando transcripción'
            });
            
            // Transcribir audio usando la ruta completa
            const result = await AudioService.processAndTranscribeAudio(audioPath);
            
            // Limpiar el archivo de audio después de la transcripción
            await safeDeleteFile(audioPath);
            
            // Formatear resultado según el formato solicitado
            let formattedResult;
            if (responseFormat === 'text') {
                formattedResult = result.transcription.split('. ').join('.\n');
            } else {
                formattedResult = { text: result.transcription };
            }
            
            // Actualizar estado: completado
            TaskService.updateTask(taskId, {
                status: 'completed',
                progress: 100,
                message: 'Transcripción completada',
                result: formattedResult
            });
            
        } catch (error: any) {
            console.error('Error en procesamiento de transcripción:', error);
            TaskService.updateTask(taskId, {
                status: 'failed',
                progress: 0,
                message: 'Error en el proceso de transcripción',
                error: error.message || 'Error desconocido'
            });
        } finally {
            // Asegurarse de que todos los archivos temporales sean eliminados
            for (const filePath of tempFiles) {
                if (!deletedFiles.has(filePath)) {
                    await safeDeleteFile(filePath);
                }
            }
        }
    }
}
