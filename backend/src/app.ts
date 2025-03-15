import express from 'express';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import { config } from './config/config';
import path from 'path';
import { StorageService } from './services/storage.service';
import { AudioService } from './services/speech.service';
import { SecretsService } from './services/secrets.service';

const app = express();

// Inicializar servicios
const initializeServices = async () => {
    try {
        // Inicializar Secret Manager primero
        SecretsService.initialize();
        
        // Inicializar los servicios que dependen de Secret Manager
        await Promise.all([
            StorageService.initialize(),
            AudioService.initialize()
        ]);
        console.log('🚀 Todos los servicios inicializados correctamente');
    } catch (error) {
        console.error('❌ Error inicializando servicios:', error);
        process.exit(1);
    }
};

// Middleware CORS personalizado - maneja mejor los diferentes clientes (Postman, navegadores, etc.)
app.use(corsMiddleware);

// Configuración JSON para garantizar respuestas consistentes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar el acceso estático a la carpeta temporal
app.use('/temp', express.static(path.join(__dirname, '..', config.tempDir)));

// Configuración global de respuestas
app.use((req, res, next) => {
    // Establecer headers por defecto para todas las respuestas
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
});

// Rutas de la API
app.use('/api', routes);

// Middleware de manejo de errores
app.use(errorHandler);

// Inicializar servicios antes de exportar la app
initializeServices();

export default app;