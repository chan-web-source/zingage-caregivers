import { Request, Response } from 'express';
import { CarelogsService } from '../services/CarelogsService';

export class CarelogsController {
  constructor(private carelogsService: CarelogsService) { }

  async getAllCarelogs(req: Request, res: Response): Promise<void> {
    try {
      const { limit = 50, offset = 0, status, caregiver_id, franchisor_id, agency_id } = req.query;
      const options = {
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
        status: status as string,
        caregiver_id: caregiver_id ? parseInt(caregiver_id as string) : undefined,
        franchisor_id: franchisor_id ? parseInt(franchisor_id as string) : undefined,
        agency_id: agency_id ? parseInt(agency_id as string) : undefined
      };
      
      const carelogs = await this.carelogsService.getAllCarelogs(options);
      res.json({ success: true, data: carelogs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCarelogById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid carelog ID' });
        return;
      }

      const carelog = await this.carelogsService.getCarelogById(id);
      if (!carelog) {
        res.status(404).json({ success: false, error: 'Carelog not found' });
        return;
      }

      res.json({ success: true, data: carelog });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createCarelog(req: Request, res: Response): Promise<void> {
    try {
      const carelog = await this.carelogsService.createCarelog(req.body);
      res.status(201).json({ success: true, data: carelog });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateCarelog(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid carelog ID' });
        return;
      }

      const updated = await this.carelogsService.updateCarelog(id, req.body);
      if (!updated) {
        res.status(404).json({ success: false, error: 'Carelog not found' });
        return;
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteCarelog(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid carelog ID' });
        return;
      }

      const deleted = await this.carelogsService.deleteCarelog(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Carelog not found' });
        return;
      }

      res.json({ success: true, message: 'Carelog deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Analytics endpoints
  async rankTopCaregivers(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.carelogsService.rankTopCaregivers(limit);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async rankLowReliabilityPerformers(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.carelogsService.rankLowReliabilityPerformers(limit);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async listDetailedComments(req: Request, res: Response): Promise<void> {
    try {
      const minCharCount = parseInt(req.query.minCharCount as string) || 100;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await this.carelogsService.listDetailedComments(minCharCount, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async rankOvertimeCaregivers(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.carelogsService.rankOvertimeCaregivers(limit);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async analyzeFranchisePerformance(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.carelogsService.analyzeFranchisePerformance();
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}