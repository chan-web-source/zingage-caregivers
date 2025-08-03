import { Request, Response } from 'express';
import { CaregiverService } from '../services/CaregiverService';

export class CaregiverController {
  constructor(private caregiverService: CaregiverService) {}

  async getAllCaregivers(req: Request, res: Response): Promise<void> {
    try {
      const caregivers = await this.caregiverService.getAllCaregivers();
      res.json({ success: true, data: caregivers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getActiveCaregivers(req: Request, res: Response): Promise<void> {
    try {
      const caregivers = await this.caregiverService.getActiveCaregivers();
      res.json({ success: true, data: caregivers });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCaregiverById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid caregiver ID' });
        return;
      }

      const caregiver = await this.caregiverService.getCaregiverById(id);
      if (!caregiver) {
        res.status(404).json({ success: false, error: 'Caregiver not found' });
        return;
      }

      res.json({ success: true, data: caregiver });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async createCaregiver(req: Request, res: Response): Promise<void> {
    try {
      const caregiver = await this.caregiverService.createCaregiver(req.body);
      res.status(201).json({ success: true, data: caregiver });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async updateCaregiver(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid caregiver ID' });
        return;
      }

      const caregiver = await this.caregiverService.updateCaregiver(id, req.body);
      if (!caregiver) {
        res.status(404).json({ success: false, error: 'Caregiver not found' });
        return;
      }

      res.json({ success: true, data: caregiver });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  async deleteCaregiver(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        res.status(400).json({ success: false, error: 'Invalid caregiver ID' });
        return;
      }

      const deleted = await this.caregiverService.deleteCaregiver(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Caregiver not found' });
        return;
      }

      res.json({ success: true, message: 'Caregiver deleted successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async bulkUploadFromCsv(req: Request, res: Response): Promise<void> {
    try {
      await this.caregiverService.bulkUploadFromCsv();
      res.json({ success: true, message: 'CSV data uploaded successfully' });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}