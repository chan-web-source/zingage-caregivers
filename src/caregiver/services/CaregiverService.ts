
import { CaregiverRepository } from '../repositories/CaregiverRepository';
import { knexInstance } from '../../infrastructure/database/knexConnection';

export class CaregiverService {
  constructor(private repository: CaregiverRepository) {
    this.repository = repository;
  }

  // Example query method
  async getActiveCaregivers() {
    return this.repository.findAllActive();
  }

  // Moved from test-caregiver.ts
  async insertData() {
    return this.repository.insertData();
  }

  // New methods corresponding to repository functions
  async rankTopCaregivers() {
    return this.repository.rankTopCaregivers();
  }

  async rankLowReliabilityPerformers() {
    return this.repository.rankLowReliabilityPerformers();
  }

  async listDetailedComments() {
    return this.repository.listDetailedComments();
  }

  async rankOvertimeCaregivers() {
    return this.repository.rankOvertimeCaregivers();
  }

  async analyzeFranchisePerformance() {
    return this.repository.analyzeFranchisePerformance();
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