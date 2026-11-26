import { leadRepository } from './lead.repository';
import { LeadStatus, LeadPriority, Prisma } from '@prisma/client';
import { Errors } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

export class LeadService {
  async createLead(data: any, actorId?: string) {
    const lead = await leadRepository.create({
      ...data,
      lastActivityAt: new Date(),
    });

    // Activity log would go here in Slot 5
    return lead;
  }

  async getLeads(query: any) {
    const { page = 1, limit = 20, status, priority, agentId } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.LeadWhereInput = {};
    if (status) where.status = status as LeadStatus;
    if (priority) where.priority = priority as LeadPriority;
    if (agentId) where.assignedAgentId = agentId;

    return leadRepository.findAll({
      skip,
      take: Number(limit),
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLeadById(id: string) {
    const lead = await leadRepository.findById(id);
    if (!lead) throw Errors.notFound('Lead');
    return lead;
  }

  async updateLead(id: string, data: any, actorId?: string) {
    await this.getLeadById(id);
    return leadRepository.update(id, data);
  }

  async assignAgent(id: string, agentId: string) {
    return leadRepository.update(id, { assignedAgent: { connect: { id: agentId } } });
  }
}

export const leadService = new LeadService();
