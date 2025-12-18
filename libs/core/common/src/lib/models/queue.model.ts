export enum QueueJobType {
  TASK_PROCESSING = 'TASK_PROCESSING',
}

export interface QueueJob<T = unknown> {
  type: QueueJobType;
  payload?: T;
}
