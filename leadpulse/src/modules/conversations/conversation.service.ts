import { conversationRepository } from './conversation.repository';
import { leadRepository } from '../leads/lead.repository';
import { ActivityType, ConversationType, LeadPriority } from '@prisma/client';
import { scoringService } from '../scoring/scoring.service';

export class ConversationService {
  async addConversation(leadId: string, agentId: string, data: any) {
    const conversation = await conversationRepository.create({
      lead: { connect: { id: leadId } },
      agent: { connect: { id: agentId } },
      ...data,
    });

    // Update lead last activity
    await leadRepository.update(leadId, { lastActivityAt: new Date() });

    // Log Activity
    await conversationRepository.createActivity({
      lead: { connect: { id: leadId } },
      actor: { connect: { id: agentId } },
      type: ActivityType.CONVERSATION_ADDED,
      description: `Added ${data.type} interaction`,
      metadata: { type: data.type },
    });

    // Trigger Scoring
    await scoringService.calculateScore(leadId);

    return conversation;
  }

  async getTimeline(leadId: string) {
    return conversationRepository.getTimeline(leadId);
  }
}

export const conversationService = new ConversationService();
