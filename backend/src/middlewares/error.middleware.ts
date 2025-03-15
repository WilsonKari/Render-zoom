import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('\n🚨 Error capturado por middleware:', err.message);
    console.error(err.stack);

    // Asegurar que se establecen headers correctos
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // Para depuración: Registrar información sobre el cliente
    const userAgent = req.headers['user-agent'] || 'desconocido';
    const clientIp = req.ip || req.socket.remoteAddress || 'desconocido';
    console.log(`📱 Cliente: ${userAgent}`);
    console.log(`🔌 IP del cliente: ${clientIp}`);

    if (err instanceof MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: {
                    message: 'El archivo excede el tamaño máximo permitido',
                    type: 'file_size_error'
                }
            });
        }
        return res.status(400).json({
            error: {
                message: 'Error en la carga del archivo',
                details: err.message,
                type: 'file_upload_error'
            }
        });
    }

    // Manejar error personalizado de tipo de archivo no soportado
    if ((err as any).code === 'UNSUPPORTED_FILE_TYPE') {
        return res.status(400).json({
            error: {
                message: 'Tipo de archivo no soportado',
                details: 'Por favor, utiliza uno de los siguientes formatos:',
                supportedFormats: (err as any).allowedTypes,
                type: 'unsupported_file_type'
            }
        });
    }

    // Error genérico con estructura consistente
    return res.status(500).json({
        error: {
            message: 'Error interno del servidor',
            details: err.message,
            type: 'server_error'
        }
    });
};