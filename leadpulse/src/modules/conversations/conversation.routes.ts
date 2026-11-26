import { Router } from 'express';
import { conversationService } from './conversation.service';
import { authenticate } from '../../middleware/auth';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

router.use(authenticate);

router.post('/:leadId', async (req, res, next) => {
  try {
    const interaction = await conversationService.addConversation(req.params.leadId, req.user!.userId, req.body);
    return sendSuccess(res, interaction, 'Conversation added');
  } catch (error) {
    next(error);
  }
});

router.get('/:leadId/timeline', async (req, res, next) => {
  try {
    const timeline = await conversationService.getTimeline(req.params.leadId);
    return sendSuccess(res, timeline);
  } catch (error) {
    next(error);
  }
});

export default router;
