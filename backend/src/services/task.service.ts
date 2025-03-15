import { v4 as uuidv4 } from 'uuid';

/**
 * Representa el estado y progreso de una tarea de transcripción
 */
export interface TaskProgress {
  id: string;                 // ID único de la tarea
  status: 'pending' | 'validating' | 'downloading' | 'converting' | 'transcribing' | 'completed' | 'failed';
  progress: number;           // Porcentaje de progreso (0-100)
  message: string;            // Mensaje descriptivo del estado actual
  error?: string;             // Mensaje de error si falló
  result?: any;               // Resultado de la transcripción si está completa
  startTime: Date;            // Cuando comenzó la tarea
  lastUpdateTime: Date;       // Última actualización
  estimatedTimeRemaining?: number; // Tiempo estimado restante en segundos
  metadata?: Record<string, any>; // Metadatos adicionales (URL de Zoom, idioma, etc.)
}

/**
 * Almacén en memoria para las tareas de transcripción
 * En un entorno de producción, esto debería reemplazarse por una
 * base de datos persistente o un servicio como Redis
 */
const taskStore: Map<string, TaskProgress> = new Map();

/**
 * Servicio para gestionar el seguimiento de tareas de transcripción
 */
export class TaskService {
  /**
   * Crea una nueva tarea de transcripción
   * @param metadata Metadatos opcionales asociados con la tarea
   * @returns ID único de la tarea creada
   */
  static createTask(metadata?: Record<string, any>): string {
    const taskId = uuidv4(); // Generar ID único
    
    const task: TaskProgress = {
      id: taskId,
      status: 'pending',
      progress: 0,
      message: 'Tarea creada, esperando procesamiento',
      startTime: new Date(),
      lastUpdateTime: new Date(),
      metadata
    };
    
    taskStore.set(taskId, task);
    console.log(`\n🆕 Tarea creada con ID: ${taskId}`);
    
    return taskId;
  }
  
  /**
   * Actualiza el estado de una tarea existente
   * @param taskId ID de la tarea a actualizar
   * @param update Campos a actualizar
   * @returns true si la actualización fue exitosa, false si la tarea no existe
   */
  static updateTask(taskId: string, update: Partial<TaskProgress>): boolean {
    const task = taskStore.get(taskId);
    
    if (!task) {
      console.warn(`⚠️ Intento de actualizar tarea inexistente: ${taskId}`);
      return false;
    }
    
    // Actualizar campos y tiempo de última actualización
    Object.assign(task, { 
      ...update, 
      lastUpdateTime: new Date() 
    });
    
    console.log(`🔄 Tarea ${taskId} actualizada: ${task.status} (${task.progress}%) - ${task.message}`);
    return true;
  }
  
  /**
   * Obtiene el estado actual de una tarea
   * @param taskId ID de la tarea
   * @returns Objeto con el estado de la tarea o null si no existe
   */
  static getTask(taskId: string): TaskProgress | null {
    if (!taskId) {
      console.warn(`⚠️ Se intentó obtener una tarea con ID inválido o vacío`);
      return null;
    }
    
    const task = taskStore.get(taskId);
    
    if (!task) {
      console.warn(`⚠️ Tarea no encontrada: ${taskId}`);
      return null;
    }
    
    // Realizar una copia profunda para evitar modificaciones accidentales
    const taskCopy = JSON.parse(JSON.stringify(task));
    
    // Convertir las fechas de vuelta a objetos Date
    taskCopy.startTime = new Date(taskCopy.startTime);
    taskCopy.lastUpdateTime = new Date(taskCopy.lastUpdateTime);
    
    console.log(`📋 Recuperada tarea ${taskId}: ${task.status} (${task.progress}%)`);
    return taskCopy;
  }
  
  /**
   * Elimina una tarea específica
   * @param taskId ID de la tarea a eliminar
   * @returns true si la tarea fue eliminada, false si no existía
   */
  static deleteTask(taskId: string): boolean {
    const exists = taskStore.has(taskId);
    
    if (exists) {
      taskStore.delete(taskId);
      console.log(`🗑️ Tarea eliminada: ${taskId}`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Limpia tareas antiguas para evitar fugas de memoria
   * @param maxAgeHours Edad máxima en horas para tareas completadas o fallidas
   */
  static cleanupTasks(maxAgeHours = 24): void {
    console.log('🧹 Iniciando limpieza de tareas antiguas...');
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [id, task] of taskStore.entries()) {
      // Eliminar tareas completadas o fallidas después del tiempo especificado
      if ((task.status === 'completed' || task.status === 'failed') && 
          (now.getTime() - task.lastUpdateTime.getTime() > maxAgeHours * 60 * 60 * 1000)) {
        taskStore.delete(id);
        cleanedCount++;
      }
    }
    
    console.log(`🧹 Limpieza completada: ${cleanedCount} tareas eliminadas. Tareas restantes: ${taskStore.size}`);
  }
  
  /**
   * Obtiene estadísticas sobre las tareas actuales
   * @returns Objeto con estadísticas de tareas
   */
  static getStats(): { total: number; byStatus: Record<string, number> } {
    const stats = {
      total: taskStore.size,
      byStatus: {} as Record<string, number>
    };
    
    for (const task of taskStore.values()) {
      const status = task.status;
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    }
    
    return stats;
  }
}
