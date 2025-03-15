"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsMiddleware = void 0;
/**
 * Middleware personalizado para gestionar CORS de manera flexible
 * Permite peticiones desde cualquier origen y con diversos métodos
 */
const corsMiddleware = (req, res, next) => {
    // Permitir cualquier origen
    res.header('Access-Control-Allow-Origin', '*');
    // Permitir headers específicos
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // Permitir métodos específicos
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    // Establecer tipo de contenido para garantizar correcta interpretación
    if (req.method === 'OPTIONS') {
        // Responder rápidamente a las solicitudes OPTIONS previa
        res.header('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).end();
    }
    next();
};
exports.corsMiddleware = corsMiddleware;
