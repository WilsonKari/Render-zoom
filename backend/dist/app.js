"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const cors_middleware_1 = require("./middlewares/cors.middleware");
const config_1 = require("./config/config");
const path_1 = __importDefault(require("path"));
const storage_service_1 = require("./services/storage.service");
const speech_service_1 = require("./services/speech.service");
const secrets_service_1 = require("./services/secrets.service");
const app = (0, express_1.default)();
// Inicializar servicios
const initializeServices = async () => {
    try {
        // Inicializar Secret Manager primero
        secrets_service_1.SecretsService.initialize();
        // Inicializar los servicios que dependen de Secret Manager
        await Promise.all([
            storage_service_1.StorageService.initialize(),
            speech_service_1.AudioService.initialize()
        ]);
        console.log('🚀 Todos los servicios inicializados correctamente');
    }
    catch (error) {
        console.error('❌ Error inicializando servicios:', error);
        process.exit(1);
    }
};
// Middleware CORS personalizado - maneja mejor los diferentes clientes (Postman, navegadores, etc.)
app.use(cors_middleware_1.corsMiddleware);
// Configuración JSON para garantizar respuestas consistentes
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Configurar el acceso estático a la carpeta temporal
app.use('/temp', express_1.default.static(path_1.default.join(__dirname, '..', config_1.config.tempDir)));
// Configuración global de respuestas
app.use((req, res, next) => {
    // Establecer headers por defecto para todas las respuestas
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});
// Rutas de la API
app.use('/api', routes_1.default);
// Middleware de manejo de errores
app.use(error_middleware_1.errorHandler);
// Inicializar servicios antes de exportar la app
initializeServices();
exports.default = app;
