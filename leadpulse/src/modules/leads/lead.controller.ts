import { Request, Response, NextFunction } from 'express';
import { leadService } from './lead.service';
import { sendSuccess, sendPaginated } from '../../utils/apiResponse';

export class LeadController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.createLead(req.body, req.user?.userId);
      return sendSuccess(res, lead, 'Lead created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { items, total } = await leadService.getLeads(req.query);
      return sendPaginated(res, items, total, Number(req.query.page || 1), Number(req.query.limit || 20));
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.getLeadById(req.params.id);
      return sendSuccess(res, lead);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const lead = await leadService.updateLead(req.params.id, req.body, req.user?.userId);
      return sendSuccess(res, lead, 'Lead updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const leadController = new LeadController();
