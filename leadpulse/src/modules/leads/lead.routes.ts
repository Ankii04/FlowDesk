import { Router } from 'express';
import { leadController } from './lead.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.use(authenticate);

/**
 * @swagger
 * /leads:
 *   get:
 *     summary: Get all leads
 *     tags: [Leads]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of leads
 *   post:
 *     summary: Create a lead
 *     tags: [Leads]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName: { type: string, example: "John Doe" }
 *               phone: { type: string, example: "+1234567890" }
 *               source: { type: string, example: "WEBSITE" }
 *     responses:
 *       201:
 *         description: Lead created
 */
router.post('/', authorize(Role.ADMIN, Role.MANAGER), leadController.create);
router.get('/', leadController.getAll);

/**
 * @swagger
 * /leads/{id}:
 *   get:
 *     summary: Get lead by ID
 *     tags: [Leads]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead details
 */
router.get('/:id', leadController.getById);
router.patch('/:id', authorize(Role.ADMIN, Role.MANAGER), leadController.update);

export default router;
