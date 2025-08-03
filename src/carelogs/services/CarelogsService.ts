import csv from 'csv-parser';
import { Readable } from 'stream';
import { CarelogsRepository } from '../repositories/CarelogsRepository';
import { Carelogs } from '../models/carelogs';

interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: string;
  status?: string;
  caregiver_id?: number;
  franchisor_id?: number;
  agency_id?: number;
}

export class CarelogsService {
  constructor(private readonly carelogsRepository: CarelogsRepository) {}

  async getAllCarelogs(options: PaginationOptions = {}): Promise<Carelogs[]> {
    try {
      const { 
        limit = 10, 
        offset = 0, 
        orderBy = 'created_at', 
        orderDirection = 'desc',
        status,
        caregiver_id,
        franchisor_id,
        agency_id
      } = options;
      
      if (limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }
      
      if (offset < 0) {
        throw new Error('Offset must be non-negative');
      }

      return await this.carelogsRepository.findAll({ 
        limit, 
        offset, 
        orderBy, 
        orderDirection: orderDirection as 'asc' | 'desc',
        status,
        caregiver_id,
        franchisor_id,
        agency_id
      });
    } catch (error) {
      console.error('Error in CarelogsService.getAllCarelogs:', error);
      throw new Error(`Failed to get all carelogs: ${error.message}`);
    }
  }

  async getCarelogById(id: number): Promise<Carelogs | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid carelog ID is required');
      }
      return await this.carelogsRepository.findById(id);
    } catch (error) {
      console.error('Error in CarelogsService.getCarelogById:', error);
      throw new Error(`Failed to get carelog: ${error.message}`);
    }
  }

  async createCarelog(carelogData: Partial<Carelogs>): Promise<Carelogs> {
    try {
      if (!carelogData) {
        throw new Error('Carelog data is required');
      }
      
      // Basic validation for required fields
      if (!carelogData.caregiver_id) {
        throw new Error('Caregiver ID is required');
      }
      
      return await this.carelogsRepository.create(carelogData);
    } catch (error) {
      console.error('Error in CarelogsService.createCarelog:', error);
      throw new Error(`Failed to create carelog: ${error.message}`);
    }
  }

  async updateCarelog(id: number, carelogData: Partial<Carelogs>): Promise<Carelogs | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid carelog ID is required');
      }
      if (!carelogData) {
        throw new Error('Carelog data is required');
      }
      return await this.carelogsRepository.update(id, carelogData);
    } catch (error) {
      console.error('Error in CarelogsService.updateCarelog:', error);
      throw new Error(`Failed to update carelog: ${error.message}`);
    }
  }

  async deleteCarelog(id: number): Promise<boolean> {
    try {
      if (!id || id <= 0) {
        throw new Error('Valid carelog ID is required');
      }
      return await this.carelogsRepository.delete(id);
    } catch (error) {
      console.error('Error in CarelogsService.deleteCarelog:', error);
      throw new Error(`Failed to delete carelog: ${error.message}`);
    }
  }

  async getCarelogCount(): Promise<number> {
    try {
      return await this.carelogsRepository.getCount();
    } catch (error) {
      console.error('Error in CarelogsService.getCarelogCount:', error);
      throw new Error(`Failed to get carelog count: ${error.message}`);
    }
  }

  // Performance Analytics Methods
  async rankTopCaregivers(limit: number = 10): Promise<any[]> {
    if (!limit || limit <= 0 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    try {
      return await this.carelogsRepository.rankTopCaregivers(limit);
    } catch (error) {
      console.error('Error in CarelogsService.rankTopCaregivers:', error);
      throw new Error(`Failed to rank top caregivers: ${error.message}`);
    }
  }

  async rankLowReliabilityPerformers(limit: number = 10): Promise<any[]> {
    if (!limit || limit <= 0 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    try {
      return await this.carelogsRepository.rankLowReliabilityPerformers(limit);
    } catch (error) {
      console.error('Error in CarelogsService.rankLowReliabilityPerformers:', error);
      throw new Error(`Failed to rank low reliability performers: ${error.message}`);
    }
  }

  async listDetailedComments(minCharCount: number = 100, limit: number = 20): Promise<any[]> {
    if (!minCharCount || minCharCount <= 0) {
      throw new Error('Minimum character count must be greater than 0');
    }
    if (!limit || limit <= 0 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    try {
      return await this.carelogsRepository.listDetailedComments(minCharCount, limit);
    } catch (error) {
      console.error('Error in CarelogsService.listDetailedComments:', error);
      throw new Error(`Failed to list detailed comments: ${error.message}`);
    }
  }

  async rankOvertimeCaregivers(limit: number = 10): Promise<any[]> {
    if (!limit || limit <= 0 || limit > 100) {
      throw new Error('Limit must be between 1 and 100');
    }
    
    try {
      return await this.carelogsRepository.rankOvertimeCaregivers(limit);
    } catch (error) {
      console.error('Error in CarelogsService.rankOvertimeCaregivers:', error);
      throw new Error(`Failed to rank overtime caregivers: ${error.message}`);
    }
  }

  async analyzeFranchisePerformance(): Promise<any[]> {
    try {
      return await this.carelogsRepository.analyzeFranchisePerformance();
    } catch (error) {
      console.error('Error in CarelogsService.analyzeFranchisePerformance:', error);
      throw new Error(`Failed to analyze franchise performance: ${error.message}`);
    }
  }
}