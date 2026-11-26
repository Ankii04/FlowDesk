import { Router, Request, Response, NextFunction } from 'express';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import { authenticate, authorize } from '../../middleware/auth';
import { conversationService } from '../conversations/conversation.service';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identifier = /^[a-zA-Z0-9_-]{1,100}$/;
const summaryFields = ['need', 'teamSize', 'timeline', 'language', 'qualification', 'reason', 'objection', 'sentiment', 'sentimentReason', 'bookingOutcome', 'nextAction'] as const;

router.use(authenticate, authorize(Role.MANAGER, Role.ADMIN));
router.use((req, res, next) => {
  if (!process.env.FORTIVEX_CRM_EMAIL || req.user!.email !== process.env.FORTIVEX_CRM_EMAIL) {
    return res.status(403).json({ message: 'Sales demo service account required.' });
  }
  next();
});

const handle = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

router.get('/slots', handle(async (_req, res) => {
  const rows = await prisma.salesSlot.findMany({
    where: { startsAt: { gt: new Date() }, run: null }, orderBy: [{ startsAt: 'asc' }, { id: 'asc' }], take: 6,
  });
  return sendSuccess(res, rows);
}));

router.get('/runs/:id', handle(async (req, res) => {
  const { id } = req.params;
  const account = String(req.query.account || '');
  if (!uuid.test(id) || !identifier.test(account)) return res.status(400).json({ message: 'Invalid sales run.' });
  const run = await prisma.salesRun.findFirst({ where: { id, account }, include: { slot: true } });
  if (!run) return res.status(404).json({ message: 'Sales run not found.' });
  const [timeline, conversation] = await Promise.all([
    conversationService.getTimeline(id),
    prisma.conversation.findUnique({ where: { id }, select: { id: true, type: true, status: true, summary: true } }),
  ]);
  return sendSuccess(res, { ...run, timeline, conversation });
}));

router.post('/runs', handle(async (req, res) => {
  const { id, account, summary, slotId = null } = req.body || {};
  if (typeof id !== 'string' || !uuid.test(id) || typeof account !== 'string' || !identifier.test(account) ||
      (slotId !== null && (typeof slotId !== 'string' || !identifier.test(slotId))) ||
      !summary || !summaryFields.every(key => typeof summary[key] === 'string' && summary[key].length <= 600) ||
      !['Qualified', 'Nurture', 'Needs review'].includes(summary.qualification)) {
    return res.status(400).json({ message: 'Invalid sales finalization.' });
  }
  const cleanSummary = Object.fromEntries(summaryFields.map(key => [key, summary[key]]));
  const existingRun = () => prisma.salesRun.findUnique({ where: { id }, include: { slot: true } });
  const replay = (existing: NonNullable<Awaited<ReturnType<typeof existingRun>>>) =>
    existing.account === account && existing.slotId === slotId
      ? sendSuccess(res, existing)
      : res.status(409).json({ code: 'session_conflict', message: 'This session already has a saved outcome.' });

  const existing = await existingRun();
  if (existing) return replay(existing);

  try {
    const run = await prisma.$transaction(async tx => {
      const slot = slotId === null ? null : await tx.salesSlot.findFirst({
        where: { id: slotId, startsAt: { gt: new Date() }, run: null },
      });
      if (slotId !== null && !slot) throw new Error('slot_unavailable');

      const result = { ...cleanSummary, bookingReference: slot ? id : null };
      const saved = await tx.salesRun.create({ data: { id, account, result, slotId }, include: { slot: true } });
      await tx.lead.create({ data: {
        id, customerName: 'Synthetic FlowDesk prospect', phone: '+12025550101', source: 'WEBSITE',
        status: summary.qualification === 'Qualified' ? 'INTERESTED' : 'FOLLOW_UP',
        tags: ['fortivex-round3'], customFields: { salesRunId: id, qualification: summary.qualification },
        assignedAgentId: req.user!.userId, nextFollowUpAt: slot?.startsAt, lastActivityAt: new Date(),
      } });
      await tx.conversation.create({ data: {
        id, leadId: id, agentId: req.user!.userId, type: 'CALL', direction: 'INBOUND',
        status: 'COMPLETED', completedAt: new Date(),
        summary: `${summary.qualification}. ${summary.need}. ${summary.bookingOutcome}`,
        notes: JSON.stringify(result),
      } });
      await tx.activity.create({ data: {
        leadId: id, actorId: req.user!.userId, type: 'CONVERSATION_ADDED',
        description: 'Saved FlowDesk sales conversation', metadata: { salesRunId: id, slotId },
      } });
      return saved;
    });
    return sendSuccess(res, run);
  } catch (error) {
    if ((error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') ||
        (error instanceof Error && error.message === 'slot_unavailable')) {
      const duplicate = await existingRun();
      if (duplicate) return replay(duplicate);
      return res.status(409).json({ code: 'slot_unavailable', message: 'That appointment is no longer available.' });
    }
    throw error;
  }
}));

export default router;
