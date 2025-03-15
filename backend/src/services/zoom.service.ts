import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { config } from '../config/config';
import { promises as fsPromises } from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

export interface DownloadResult {
    success: boolean;
    filePath: string | null;
    message: string;
}

export interface UrlValidationResult {
    valid: boolean;
    message: string;
}

// Almacenar un registro de URLs procesadas y sus archivos correspondientes
interface ProcessedUrlRecord {
    url: string;
    filePath: string;
    timestamp: number; // Timestamp para posible limpieza futura
}

export class ZoomService {
    // Cache en memoria de URLs procesadas
    private static processedUrls: Map<string, ProcessedUrlRecord> = new Map();
    
    // Máximo número de URLs a mantener en caché
    private static readonly MAX_CACHED_URLS: number = 5;
    
    /**
     * Genera un hash único para una URL
     * @param url URL a hashear
     * @returns Hash único para la URL
     */
    private static getUrlHash(url: string): string {
        return crypto.createHash('md5').update(url).digest('hex');
    }
    
    /**
     * Registra una URL procesada y su archivo correspondiente
     * @param url URL procesada
     * @param filePath Ruta del archivo
     */
    private static registerProcessedUrl(url: string, filePath: string): void {
        const urlHash = this.getUrlHash(url);
        
        // Verificar si ya tenemos el máximo de URLs en caché
        if (this.processedUrls.size >= this.MAX_CACHED_URLS) {
            // Encontrar la entrada más antigua basada en timestamp
            let oldestKey: string | null = null;
            let oldestTime = Date.now();
            
            this.processedUrls.forEach((record, key) => {
                if (record.timestamp < oldestTime) {
                    oldestTime = record.timestamp;
                    oldestKey = key;
                }
            });
            
            // Eliminar la entrada más antigua
            if (oldestKey) {
                const oldRecord = this.processedUrls.get(oldestKey);
                console.log(`🧹 Eliminando entrada más antigua del caché: ${oldRecord?.url}`);
                this.processedUrls.delete(oldestKey);
            }
        }
        
        // Agregar la nueva entrada
        this.processedUrls.set(urlHash, {
            url,
            filePath,
            timestamp: Date.now()
        });
        console.log(`📝 URL registrada en caché: ${url} -> ${filePath}`);
        console.log(`ℹ️ Total de URLs en caché: ${this.processedUrls.size}/${this.MAX_CACHED_URLS}`);
    }
    
    /**
     * Verifica si una URL ya ha sido procesada
     * @param url URL a verificar
     * @returns Ruta del archivo si existe, null si no
     */
    private static getProcessedUrlFile(url: string): string | null {
        const urlHash = this.getUrlHash(url);
        const record = this.processedUrls.get(urlHash);
        
        if (record && fs.existsSync(record.filePath)) {
            console.log(`🔍 URL encontrada en caché: ${url}`);
            console.log(`📁 Usando archivo existente: ${record.filePath}`);
            return record.filePath;
        }
        
        return null;
    }

    /**
     * Valida si una URL de Zoom es correcta y contiene un video accesible
     * @param zoomUrl URL del video de Zoom a validar
     * @returns Objeto con el resultado de la validación
     */
    static async validateZoomUrl(zoomUrl: string): Promise<UrlValidationResult> {
        let browser: Browser | null = null;
        
        try {
            console.log(`🔍 Validando URL de Zoom: ${zoomUrl}`);
            
            // Verificar formato básico de URL
            if (!zoomUrl.includes('zoom.us')) {
                return { 
                    valid: false, 
                    message: 'La URL proporcionada no parece ser una URL de Zoom válida' 
                };
            }
            
            // Lanzar navegador para verificar la URL
            browser = await chromium.launch({ headless: true });
            const context = await browser.newContext();
            const page = await context.newPage();
            
            // Configura un timeout razonable para cargar la página
            await page.goto(zoomUrl, { timeout: 30000, waitUntil: 'domcontentloaded' });
            
            // Esperar un poco para que carguen los elementos relevantes
            await page.waitForTimeout(3000);
            
            // Capturar una screenshot para diagnóstico
            const screenshotPath = path.join(process.cwd(), 'temp', 'validation_screenshot.png');
            await fs.promises.mkdir(path.join(process.cwd(), 'temp'), { recursive: true });
            await page.screenshot({ path: screenshotPath });
            
            // Verificar mensajes de error comunes
            const errorMessages = [
                'Esta grabación no existe',
                'This recording does not exist',
                'Meeting has been removed',
                'La reunión ha sido eliminada',
                'Recording has expired',
                'La grabación ha caducado',
                'Access Denied',
                'Acceso denegado'
            ];
            
            for (const errorText of errorMessages) {
                const errorElement = page.locator(`text="${errorText}"`);
                const count = await errorElement.count();
                
                if (count > 0) {
                    console.log(`⚠️ Se encontró mensaje de error: "${errorText}"`);
                    return { 
                        valid: false, 
                        message: `Error en la URL de Zoom: ${errorText}` 
                    };
                }
            }
            
            // Verificar si hay elementos de video o reproductor
            const videoSelectors = ['video', '.vjs-tech', '#vjs_video_3', '.video-js', '[aria-label="Video Player"]'];
            let videoFound = false;
            
            for (const selector of videoSelectors) {
                const videoElement = page.locator(selector);
                const count = await videoElement.count();
                
                if (count > 0) {
                    console.log(`✅ Elemento de video encontrado con selector: ${selector}`);
                    videoFound = true;
                    break;
                }
            }
            
            // Si no encontramos un video pero tampoco errores, verificamos otros elementos típicos de Zoom
            if (!videoFound) {
                // Buscar elementos específicos de páginas de Zoom válidas (como título, logo, etc.)
                const zoomElements = [
                    '.zm-login',
                    '.zm-button',
                    '[data-id="app"]',
                    '[class*="zmu-"]',
                    '[class*="zoomapp-"]'
                ];
                
                for (const selector of zoomElements) {
                    const element = page.locator(selector);
                    const count = await element.count();
                    
                    if (count > 0) {
                        console.log(`🔄 Elemento de interfaz de Zoom encontrado: ${selector}`);
                        // Si encontramos elementos de Zoom pero no video, podría ser una página de espera o autenticación
                        return { 
                            valid: true, 
                            message: 'URL de Zoom válida, pero podría requerir autenticación o acciones adicionales' 
                        };
                    }
                }
                
                // Si llegamos aquí, no encontramos ni video ni elementos de Zoom
                console.log('❌ No se encontró contenido de video ni elementos de Zoom en la página');
                return {
                    valid: false,
                    message: 'La URL proporcionada no parece contener un video de Zoom o no es accesible'
                };
            }
            
            return { 
                valid: true, 
                message: 'URL de Zoom válida con contenido de video' 
            };
        } catch (error) {
            // Si es un error de timeout o navegación, es probable que la URL sea inválida
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error(`❌ Error al validar URL: ${errorMessage}`);
            
            // Determinar si es un error de red/acceso o un error general
            if (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || 
                errorMessage.includes('ERR_CONNECTION_REFUSED') ||
                errorMessage.includes('ERR_CONNECTION_RESET') ||
                errorMessage.includes('timeout')) {
                return {
                    valid: false,
                    message: `No se pudo acceder a la URL de Zoom: problema de conexión o URL incorrecta`
                };
            }
            
            return {
                valid: false,
                message: `Error al validar la URL de Zoom: ${errorMessage}`
            };
        } finally {
            if (browser) {
                await browser.close();
                console.log('🔒 Navegador de validación cerrado');
            }
        }
    }

    /**
     * Descarga un video de Zoom a partir de su URL
     * @param zoomUrl URL del video de Zoom a descargar
     * @param downloadPath Ruta donde se guardará el video (opcional)
     * @returns Objeto con el resultado de la descarga
     */
    static async downloadZoomVideo(zoomUrl: string, downloadPath?: string): Promise<DownloadResult> {
        // Validar primero la URL
        const urlValidation = await this.validateZoomUrl(zoomUrl);
        if (!urlValidation.valid) {
            return {
                success: false,
                filePath: null,
                message: urlValidation.message
            };
        }
        
        // Configurar la ruta de descarga
        const targetPath = downloadPath || path.join(process.cwd(), 'downloads');
        
        // Asegurarse de que el directorio de destino existe
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        
        // Resultado por defecto
        const result: DownloadResult = {
            success: false,
            filePath: null,
            message: ''
        };
        
        console.log(`🔍 Iniciando descarga del video de Zoom desde: ${zoomUrl}`);
        console.log(`📂 Los archivos se guardarán en: ${targetPath}`);
        
        // PASO 1: Verificar si esta URL específica ya fue procesada
        const cachedFilePath = this.getProcessedUrlFile(zoomUrl);
        if (cachedFilePath) {
            // Copiar el archivo a la carpeta de destino si es necesario
            const fileName = path.basename(cachedFilePath);
            const destPath = path.join(targetPath, fileName);
            
            if (cachedFilePath !== destPath) {
                // Solo copiar si las rutas son diferentes
                if (!fs.existsSync(destPath)) {
                    fs.copyFileSync(cachedFilePath, destPath);
                    console.log(`📁 Archivo copiado de caché a: ${destPath}`);
                } else {
                    console.log(`📝 Archivo ya existe en destino: ${destPath}`);
                }
                
                result.success = true;
                result.filePath = destPath;
                result.message = `Video recuperado de caché: ${fileName}`;
                return result;
            } else {
                // Ya está en la ubicación correcta
                result.success = true;
                result.filePath = cachedFilePath;
                result.message = `Video encontrado en caché: ${fileName}`;
                return result;
            }
        }
        
        // PASO 2: Verificar descargas previas que coincidan con patrones de Zoom
        // pero que no estén en nuestra caché (para compatibilidad con versiones anteriores)
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        console.log(`🔍 También verificaremos descargas en: ${downloadsDir}`);

        // Buscar archivos con patrones de Zoom
        const existingFiles = this.findExistingZoomVideos(downloadsDir);

        if (existingFiles.length > 0) {
            console.log('🔍 Se encontraron archivos de Zoom descargados previamente:');
            
            // Usaremos el archivo más reciente para esta nueva URL
            // ya que no tenemos forma de saber qué archivo corresponde a qué URL
            let newestFile = existingFiles[0];
            let newestTime = fs.statSync(newestFile).mtime.getTime();
            
            for (const file of existingFiles) {
                const fileStats = fs.statSync(file);
                const fileSizeMB = fileStats.size / (1024 * 1024);
                const fileTime = fileStats.mtime.getTime();
                const fileName = path.basename(file);
                
                console.log(`  - ${fileName} (${fileSizeMB.toFixed(2)} MB) - ${new Date(fileTime).toLocaleString()}`);
                
                // Encontrar el archivo más reciente
                if (fileTime > newestTime) {
                    newestFile = file;
                    newestTime = fileTime;
                }
            }
            
            // Usar el archivo más reciente y registrarlo en nuestra caché para esta URL
            const newestFileName = path.basename(newestFile);
            console.log(`📁 Usando el archivo más reciente: ${newestFileName}`);
            
            const destPath = path.join(targetPath, newestFileName);
            if (!fs.existsSync(destPath)) {
                fs.copyFileSync(newestFile, destPath);
                console.log(`📁 Archivo copiado exitosamente a: ${destPath}`);
            } else {
                console.log(`📝 El archivo ya existe en la carpeta de destino: ${destPath}`);
            }
            
            // Registrar esta URL y el archivo en nuestro caché
            this.registerProcessedUrl(zoomUrl, destPath);
            
            result.success = true;
            result.filePath = destPath;
            result.message = `Archivo más reciente utilizado: ${newestFileName}`;
            return result;
        }
        
        // Si no hay archivos existentes, iniciar descarga con Playwright
        console.log('🚀 No se encontraron archivos descargados. Iniciando descarga automatizada...');
        
        let browser: Browser | null = null;
        
        try {
            // Lanzar navegador en modo headless
            browser = await chromium.launch({ headless: true });
            
            // Crear un nuevo contexto
            const context = await browser.newContext({ acceptDownloads: true });
            
            // Abrir una nueva página
            const page = await context.newPage();
            
            // Navegar a la URL
            console.log('🌐 Navegando a la página del video...');
            await page.goto(zoomUrl, { waitUntil: 'networkidle' });
            console.log('✅ Página cargada completamente');
            
            // Tomar captura para diagnóstico
            await page.screenshot({ path: path.join(targetPath, 'zoom_page_loaded.png') });
            
            // Esperar un poco para asegurar que la página cargó completamente
            await page.waitForTimeout(5000);
            
            // Intentar descargar el video utilizando diversos selectores
            const downloadPromise = this.attemptVideoDownload(page);
            
            // Esperar a que termine la descarga con un timeout
            const timeoutPromise = new Promise<null>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout esperando la descarga')), 15 * 60 * 1000); // 15 minutos
            });
            
            // Esperar la descarga o el timeout, lo que ocurra primero
            const download = await Promise.race([downloadPromise, timeoutPromise]);
            
            if (!download) {
                throw new Error('No se pudo iniciar la descarga del video');
            }
            
            console.log(`🎥 Descarga iniciada: ${download.suggestedFilename()}`);
            
            // Guardar el archivo en la ruta de destino
            const savePath = path.join(targetPath, download.suggestedFilename());
            await download.saveAs(savePath);
            console.log(`💾 Archivo guardado como: ${savePath}`);
            
            // Verificar que el archivo se descargó correctamente
            if (fs.existsSync(savePath)) {
                const stats = fs.statSync(savePath);
                if (stats.size > 0) {
                    console.log(`✅ Archivo descargado correctamente (${(stats.size / (1024 * 1024)).toFixed(2)} MB)`);
                    result.success = true;
                    result.filePath = savePath;
                    result.message = `Descarga completada: ${download.suggestedFilename()}`;
                } else {
                    throw new Error('El archivo descargado está vacío');
                }
            } else {
                throw new Error('No se pudo guardar el archivo descargado');
            }
            
            // Registrar esta URL y el archivo en nuestro caché
            this.registerProcessedUrl(zoomUrl, savePath);
            
            return result;
        } catch (error) {
            // Manejar errores
            const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
            console.error(`❌ Error al descargar el video: ${errorMessage}`);
            
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
            
            result.message = `Error al descargar el video: ${errorMessage}`;
            return result;
        } finally {
            // Cerrar el navegador
            if (browser) {
                await browser.close();
                console.log('🔒 Navegador cerrado');
            }
        }
    }
    
    /**
     * Busca archivos de video de Zoom existentes en el directorio de descargas
     * @param directory Directorio donde buscar
     * @returns Array con las rutas de los archivos encontrados
     */
    private static findExistingZoomVideos(directory: string): string[] {
        // Patrones típicos de archivos de Zoom
        const patterns = [
            // UUID formato Zoom
            '*-*-*-*-*', 
            // Archivos MP4 que contienen 'zoom' en el nombre
            '*zoom*.mp4'
        ];
        
        const results: string[] = [];
        
        for (const pattern of patterns) {
            try {
                const files = glob.sync(path.join(directory, pattern));
                results.push(...files);
            } catch (error) {
                console.warn(`⚠️ Error buscando con patrón ${pattern}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Intenta descargar el video de diferentes maneras
     * @param page Página de Playwright
     * @returns Promise con el objeto de descarga
     */
    private static async attemptVideoDownload(page: Page) {
        // Lista de selectores para botones de descarga
        const downloadButtons = [
            'button:has-text("Download")',
            'button:has-text("Descargar")',
            '[aria-label="download"]',
            '[title="Download"]',
            '[title="Descargar"]',
            '.download-btn',
            '#download-btn',
            'button.more-btn',
            '[aria-label="More"]',
            '.zm-btn'
        ];
        
        // Intentar cada selector
        for (const selector of downloadButtons) {
            try {
                const elements = page.locator(selector);
                const count = await elements.count();
                
                if (count > 0) {
                    console.log(`🔘 Botón encontrado con selector: ${selector}, cantidad: ${count}`);
                    
                    // Configurar espera de descarga ANTES de hacer clic
                    const downloadPromise = page.waitForEvent('download');
                    await elements.first().click();
                    console.log(`👆 Clic realizado en botón con selector: ${selector}`);
                    
                    return downloadPromise;
                }
            } catch (error) {
                console.warn(`⚠️ Error al intentar selector ${selector}:`, error);
            }
        }
        
        // Si no encontramos un botón directo, intentamos con el menú contextual
        console.log('🔍 No se encontró botón de descarga directo, intentando menú contextual...');
        
        const videoSelectors = ['video', '.vjs-tech', '#vjs_video_3', '.video-js'];
        
        for (const videoSelector of videoSelectors) {
            try {
                const videoElement = page.locator(videoSelector);
                const count = await videoElement.count();
                
                if (count > 0) {
                    console.log(`🎬 Elemento de video encontrado con selector: ${videoSelector}`);
                    
                    // Configurar espera de descarga
                    const downloadPromise = page.waitForEvent('download');
                    
                    // Hacer clic derecho en el video
                    await videoElement.first().click({ button: 'right' });
                    await page.waitForTimeout(1000);
                    
                    // Opciones de menú contextual
                    const contextMenuOptions = [
                        'text=Download',
                        'text=Descargar',
                        'text=Save video as',
                        'text=Guardar video como'
                    ];
                    
                    for (const option of contextMenuOptions) {
                        const optionElement = page.locator(option);
                        if (await optionElement.count() > 0) {
                            await optionElement.click();
                            console.log(`👆 Clic en opción de menú contextual: ${option}`);
                            return downloadPromise;
                        }
                    }
                    
                    // Si no encontramos ninguna opción, cancelamos
                    console.log('⚠️ No se encontró opción de descarga en el menú contextual');
                    // Hacer clic en cualquier lugar para cerrar el menú
                    await page.mouse.click(0, 0);
                }
            } catch (error) {
                console.warn(`⚠️ Error al intentar menú contextual con selector ${videoSelector}:`, error);
            }
        }
        
        throw new Error('No se encontró ningún botón o método de descarga');
    }
}
