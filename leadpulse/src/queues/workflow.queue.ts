import { Queue } from 'bullmq';
import { bullmqRedisConnection } from '../config/redis';

// Define Queues
export const workflowQueue = new Queue('workflow-queue', {
  connection: bullmqRedisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
  }
});

export const slaQueue = new Queue('sla-queue', {
  connection: bullmqRedisConnection,
});
