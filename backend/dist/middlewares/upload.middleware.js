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
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const fs = __importStar(require("fs"));
// Asegurar que el directorio temporal existe
if (!fs.existsSync(config_1.config.tempDir)) {
    fs.mkdirSync(config_1.config.tempDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config_1.config.tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
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
    const formatMimeType = (mime) => {
        const [type, subtype] = mime.split('/');
        return `${type === 'video' ? '🎥' : '🎵'} .${subtype}`;
    };
    return config_1.config.allowedFileTypes
        .map(formatMimeType)
        .join('\n');
};
const fileFilter = (req, file, cb) => {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    // Verificar si es un tipo MIME de audio/video o si es application/octet-stream con extensión permitida
    if (file.mimetype.startsWith('audio/') ||
        file.mimetype.startsWith('video/') ||
        (file.mimetype === 'application/octet-stream' && allowedExtensions.includes(ext))) {
        cb(null, true);
    }
    else {
        // Si no cumple los criterios, rechazar
        const error = new Error('Tipo de archivo no soportado');
        error.code = 'UNSUPPORTED_FILE_TYPE';
        error.message = 'Por favor, utiliza uno de los siguientes formatos:';
        error.supportedFormats = allowedExtensions
            .map(ext => `${ext.includes('mp4') || ext.includes('mpeg') || ext.includes('quicktime') ? '🎥' : '🎵'} ${ext}`)
            .join('\n');
        cb(error);
    }
};
exports.upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: config_1.config.maxFileSize
    }
});
