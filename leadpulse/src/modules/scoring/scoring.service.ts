import { leadRepository } from '../leads/lead.repository';
import { prisma } from '../../config/database';
import { LeadPriority, ActivityType } from '@prisma/client';

export class ScoringService {
  async calculateScore(leadId: string) {
    const lead = await leadRepository.findById(leadId);
    if (!lead) return;

    let score = lead.score;

    // Rule: Recent conversation
    const conversations = await prisma.conversation.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    if (conversations.length > 0) {
      score += 10;
      // Rule: Quick response bonus (placeholder logic)
      if (conversations[0].responseTimeMinutes && conversations[0].responseTimeMinutes < 5) {
        score += 20;
      }
    }

    // Cap score
    score = Math.min(100, Math.max(0, score));

    // Determine Priority
    let priority: LeadPriority = LeadPriority.COLD;
    if (score >= 70) priority = LeadPriority.HOT;
    else if (score >= 40) priority = LeadPriority.WARM;

    await leadRepository.update(leadId, { score, priority });

    return { score, priority };
  }
}

export const scoringService = new ScoringService();
