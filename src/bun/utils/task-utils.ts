// src/utils/task-utils.ts
import { type TaskStatus, type TaskMetadata, type Task } from '../types';
import { fileuploadTaskQueue } from './queue';

/**
 * Creates a new task for monitoring the conversion process
 */
export const createConversionTask = (taskMetadata: TaskMetadata | any): string => {
  const taskId = fileuploadTaskQueue.addTask(taskMetadata);
  return taskId;
};

/**
 * Updates the status of a conversion task
 */
export const updateTaskStatus = (status: TaskStatus, taskId: string): void => {
  if (!taskId) {
    console.log('Attempted to update task status with no taskId');
    return;
  }
  
  fileuploadTaskQueue.updateTaskStatus(taskId, status);
  console.log(`Task ${taskId} status updated to: ${status}`);
};

/**
 * Handles task completion
 */
export const completeTask = (taskId: string): Task | null => {
  updateTaskStatus('completed', taskId);
  return fileuploadTaskQueue.getTask(taskId);
};

/**
 * Handles task failure
 */
export const failTask = (taskId: string, error: Error): void => {
  updateTaskStatus('failed', taskId);
  console.error(`Task ${taskId} failed: ${error.message}`);
};