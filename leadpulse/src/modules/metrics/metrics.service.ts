import { prisma } from '../../config/database';
import { workflowQueue } from '../../queues/workflow.queue';

export class MetricsService {
  async getDashboardMetrics() {
    const [leadsCount, activeAgents, slaBreaches] = await Promise.all([
      prisma.lead.count(),
      prisma.user.count({ where: { role: 'AGENT', isActive: true } }),
      prisma.lead.count({ where: { slaBreached: true } }),
    ]);

    const queueStats = await workflowQueue.getJobCounts();

    return {
      overview: {
        totalLeads: leadsCount,
        activeAgents,
        slaBreachCount: slaBreaches,
      },
      queue: queueStats,
      timestamp: new Date(),
    };
  }
}

export const metricsService = new MetricsService();
