// queue.ts
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface Task {
  id: string;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  data: Record<string, any>;
}

class TaskQueue {
  private tasks: Record<string, Task> = {};
  private filePath: string;

  constructor(filePath: string = './tasks.json') {
    this.filePath = filePath;
    this.loadTasks();
  }

  private async loadTasks(): Promise<void> {
    try {
      const file = Bun.file(this.filePath);
      if (await file.exists()) {
        const content = await file.text();
        this.tasks = JSON.parse(content);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }

  private async saveTasks(): Promise<void> {
    try {
      await Bun.write(this.filePath, JSON.stringify(this.tasks, null, 2));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  }

  addTask(data: Record<string, any>): string {
    const id = Date.now().toString();
    const now = new Date();
    
    this.tasks[id] = {
      id,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      data
    };

    this.saveTasks();
    return id;
  }

  updateTaskStatus(id: string, status: TaskStatus): boolean {
    if (!this.tasks[id]) return false;
    
    this.tasks[id].status = status;
    this.tasks[id].updatedAt = new Date();
    this.saveTasks();
    return true;
  }

  getTask(id: string): Task | null {
    return this.tasks[id] || null;
  }

  getAllTasks(): Task[] {
    return Object.values(this.tasks);
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return Object.values(this.tasks).filter(task => task.status === status);
  }
}
const fileuploadTaskQueue = new TaskQueue('./tasks.json');
export {
    fileuploadTaskQueue,
    TaskQueue
}