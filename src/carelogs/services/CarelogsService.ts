import csv from 'csv-parser';
import { Readable } from 'stream';
import { CarelogsRepository } from '../repositories/CarelogsRepository';
import { Carelogs, CreateCarelogsDto, UpdateCarelogsDto, BulkUploadResult } from '../models/carelogs';
// src/caregiver/services/CaregiverService.ts

export class CarelogsService {
  constructor(private repository: CarelogsRepository) {

  }

  // Example query method
  async getAllCarelogs() {
    return this.repository.findAllActive();
  }


}