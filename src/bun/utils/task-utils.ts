// src/utils/task-utils.ts
import { type TaskStatus, type TaskMetadata } from '../types';
import { fileuploadTaskQueue } from './queue';

/**
 * Creates a new task for monitoring the conversion process
 */
export const createConversionTask = (taskMetadata: TaskMetadata): string => {
  const taskId = fileuploadTaskQueue.addTask(taskMetadata);
  return taskId;
};

/**
 * Updates the status of a conversion task
 */
export const updateTaskStatus = (status: TaskStatus, taskId: string): void => {
  if (!taskId) {
    console.warn('Attempted to update task status with no taskId');
    return;
  }
  
  fileuploadTaskQueue.updateTaskStatus(taskId, status as import('./queue').TaskStatus);
  console.log(`Task ${taskId} status updated to: ${status}`);
};

/**
 * Handles task completion
 */
export const completeTask = (taskId: string, result: any): void => {
  updateTaskStatus('completed', taskId);
  console.log(`Task ${taskId} completed successfully`);
};

/**
 * Handles task failure
 */
export const failTask = (taskId: string, error: Error): void => {
  updateTaskStatus('failed', taskId);
  console.error(`Task ${taskId} failed: ${error.message}`);
};