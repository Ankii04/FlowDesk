import { prisma } from '../../config/database';
import { Conversation, Activity, Prisma, ActivityType } from '@prisma/client';

export class ConversationRepository {
  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return prisma.conversation.create({ data });
  }

  async findByLeadId(leadId: string): Promise<Conversation[]> {
    return prisma.conversation.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: { agent: { select: { id: true, name: true } } },
    });
  }

  async createActivity(data: Prisma.ActivityCreateInput): Promise<Activity> {
    return prisma.activity.create({ data });
  }

  async getTimeline(leadId: string) {
    return prisma.activity.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: { id: true, name: true } } },
    });
  }
}

export const conversationRepository = new ConversationRepository();
