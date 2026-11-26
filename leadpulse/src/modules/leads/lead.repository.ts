import { prisma } from '../../config/database';
import { Lead, LeadStatus, LeadPriority, Prisma } from '@prisma/client';

export class LeadRepository {
  async create(data: Prisma.LeadCreateInput): Promise<Lead> {
    return prisma.lead.create({ data });
  }

  async findById(id: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { id },
      include: { assignedAgent: true },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: Prisma.LeadWhereInput;
    orderBy?: Prisma.LeadOrderByWithRelationInput;
  }) {
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        ...params,
        include: { assignedAgent: true },
      }),
      prisma.lead.count({ where: params.where }),
    ]);
    return { items, total };
  }

  async update(id: string, data: Prisma.LeadUpdateInput): Promise<Lead> {
    return prisma.lead.update({
      where: { id },
      data,
      include: { assignedAgent: true },
    });
  }

  async delete(id: string): Promise<Lead> {
    return prisma.lead.delete({ where: { id } });
  }
}

export const leadRepository = new LeadRepository();
