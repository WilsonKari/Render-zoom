import multer from 'multer';
import path from 'path';
import { config } from '../config/config';
import * as fs from 'fs';

// Asegurar que el directorio temporal existe
if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config.tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Lista de extensiones de archivo permitidas
const allowedExtensions = [
    // Video
    '.mp4', '.mpeg', '.quicktime',
    // Audio
    '.mp3', '.ogg', '.oga', '.wav', '.x-wav'
];

// Función auxiliar para formatear los tipos MIME
const formatAllowedTypes = () => {
    const formatMimeType = (mime: string) => {
        const [type, subtype] = mime.split('/');
        return `${type === 'video' ? '🎥' : '🎵'} .${subtype}`;
    };

    return config.allowedFileTypes
        .map(formatMimeType)
        .join('\n');
};

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Verificar si es un tipo MIME de audio/video o si es application/octet-stream con extensión permitida
    if (
        file.mimetype.startsWith('audio/') || 
        file.mimetype.startsWith('video/') ||
        (file.mimetype === 'application/octet-stream' && allowedExtensions.includes(ext))
    ) {
        cb(null, true);
    } else {
        // Si no cumple los criterios, rechazar
        const error: any = new Error('Tipo de archivo no soportado');
        error.code = 'UNSUPPORTED_FILE_TYPE';
        error.message = 'Por favor, utiliza uno de los siguientes formatos:';
        error.supportedFormats = allowedExtensions
            .map(ext => `${ext.includes('mp4') || ext.includes('mpeg') || ext.includes('quicktime') ? '🎥' : '🎵'} ${ext}`)
            .join('\n');
        cb(error);
    }
};

export const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config.maxFileSize
    }
});