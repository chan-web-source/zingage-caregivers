
import { CaregiverRepository } from '../repositories/CaregiverRepository';
import { Caregiver } from '../models/caregiver';

export class CaregiverService {
  constructor(private repository: CaregiverRepository) {}

  async getAllCaregivers(): Promise<Caregiver[]> {
    return this.repository.findAll();
  }

  async getActiveCaregivers(): Promise<Caregiver[]> {
    return this.repository.findAllActive();
  }

  async getCaregiverById(id: number): Promise<Caregiver | null> {
    return this.repository.findById(id);
  }

  async createCaregiver(caregiverData: Partial<Caregiver>): Promise<Caregiver> {
    return this.repository.create(caregiverData);
  }

  async updateCaregiver(id: number, caregiverData: Partial<Caregiver>): Promise<Caregiver | null> {
    return this.repository.update(id, caregiverData);
  }

  async deleteCaregiver(id: number): Promise<boolean> {
    return this.repository.delete(id);
  }

  async bulkUploadFromCsv(): Promise<void> {
    return this.repository.insertData();
  }
}

// Test function to run the service
async function caregiverService() {
  const repo = new CaregiverRepository(knexInstance);
  const service = new CaregiverService(repo);

  try {
    console.log('Top Perform Caregivers:');
    const rankTopCaregivers = await service.rankTopCaregivers();
    console.log(rankTopCaregivers);

    console.log('\nLow Reliability Performers:');
    const lowReliabilityPerformers = await service.rankLowReliabilityPerformers();
    console.log(lowReliabilityPerformers);

    console.log('\nDetailed Comments:');
    const detailedComments = await service.listDetailedComments();
    console.log(detailedComments);

    console.log('\nOvertime Caregivers:');
    const overtimeCaregivers = await service.rankOvertimeCaregivers();
    console.log(overtimeCaregivers);

    console.log('\nFranchise Performance Analysis:');
    const franchisePerformance = await service.analyzeFranchisePerformance();
    console.log(franchisePerformance);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await knexInstance.destroy();
  }
}

async function caregiverInsertData() {
  const repo = new CaregiverRepository(knexInstance);
  const service = new CaregiverService(repo);

  try {
    await service.insertData();
    console.log('Data insertion completed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await knexInstance.destroy();
  }
}

// Only run the test if this file is executed directly
if (require.main === module) {
  caregiverService();
}