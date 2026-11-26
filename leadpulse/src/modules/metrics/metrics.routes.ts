import { Router } from 'express';
import { metricsService } from './metrics.service';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';
import { sendSuccess } from '../../utils/apiResponse';

const router = Router();

router.get('/', authenticate, authorize(Role.ADMIN, Role.MANAGER), async (req, res, next) => {
  try {
    const metrics = await metricsService.getDashboardMetrics();
    return sendSuccess(res, metrics);
  } catch (error) {
    next(error);
  }
});

export default router;
