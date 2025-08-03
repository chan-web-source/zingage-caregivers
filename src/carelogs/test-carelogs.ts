import { CarelogsRepository } from './repositories/CarelogsRepository';
import { CarelogsService } from './services/CarelogsService';
import { knexInstance } from '../infrastructure/database/knexConnection';
import { CreateCarelogData, CarelogStatus, VisitType, ClockMethod } from './models/carelogs';

// Test CarelogsRepository
async function testCarelogsRepository() {
  console.log('Testing CarelogsRepository...');
  
  const carelogsRepository = new CarelogsRepository(knexInstance);
  
  try {
    // Test findAll with pagination and filters
    console.log('Testing findAll with pagination and filters...');
    const carelogs = await carelogsRepository.findAll(
      { limit: 10, offset: 0 },
      { status: 'completed' }
    );
    console.log(`Found ${carelogs.length} completed carelogs`);
    
    // Test getCount with filters
    console.log('Testing getCount with filters...');
    const totalCount = await carelogsRepository.getCount();
    const completedCount = await carelogsRepository.getCount({ status: 'completed' });
    console.log(`Total carelogs: ${totalCount}, Completed: ${completedCount}`);
    
    // Test performance analytics with updated methods
    console.log('Testing rankTopCaregivers...');
    const topCaregivers = await carelogsRepository.rankTopCaregivers(5);
    console.log(`Top 5 caregivers found: ${topCaregivers.length}`);
    
    console.log('Testing rankLowReliabilityPerformers...');
    const lowReliability = await carelogsRepository.rankLowReliabilityPerformers(5);
    console.log(`Low reliability performers found: ${lowReliability.length}`);
    
    console.log('Testing listDetailedComments...');
    const detailedComments = await carelogsRepository.listDetailedComments(50, 10);
    console.log(`Detailed comments found: ${detailedComments.length}`);
    
    console.log('Testing rankOvertimeCaregivers...');
    const overtimeCaregivers = await carelogsRepository.rankOvertimeCaregivers(5);
    console.log(`Overtime caregivers found: ${overtimeCaregivers.length}`);
    
    console.log('Testing analyzeFranchisePerformance...');
    const franchisePerformance = await carelogsRepository.analyzeFranchisePerformance();
    console.log(`Franchise performance data: ${franchisePerformance.length}`);
    
  } catch (error) {
    console.error('CarelogsRepository test failed:', error);
  }
}

// Test CarelogsService
async function testCarelogsService() {
  console.log('\nTesting CarelogsService...');
  
  const carelogsRepository = new CarelogsRepository(knexInstance);
  const carelogsService = new CarelogsService(carelogsRepository);
  
  try {
    // Test getAllCarelogs with pagination and filters
    console.log('Testing getAllCarelogs with pagination and filters...');
    const paginationOptions = { limit: 5, offset: 0 };
    const filters = { status: 'completed' };
    const carelogs = await carelogsService.getAllCarelogs(paginationOptions, filters);
    console.log(`Retrieved ${carelogs.length} completed carelogs with pagination`);
    
    // Test analytics methods with updated signatures
    console.log('Testing analytics methods...');
    
    const topCaregivers = await carelogsService.rankTopCaregivers(3);
    console.log(`Top 3 caregivers retrieved: ${topCaregivers.length}`);
    
    const lowReliability = await carelogsService.rankLowReliabilityPerformers(3);
    console.log(`Low reliability performers retrieved: ${lowReliability.length}`);
    
    const detailedComments = await carelogsService.listDetailedComments(100, 5);
    console.log(`Detailed comments (>100 chars) retrieved: ${detailedComments.length}`);
    
    const overtimeCaregivers = await carelogsService.rankOvertimeCaregivers(3);
    console.log(`Overtime caregivers retrieved: ${overtimeCaregivers.length}`);
    
    const franchisePerformance = await carelogsService.analyzeFranchisePerformance();
    console.log(`Franchise performance analysis completed: ${franchisePerformance.length} franchises`);
    
    // Test CRUD operations
    console.log('\nTesting CRUD operations...');
    
    // Test create carelog (if we have valid foreign key data)
    try {
      const newCarelogData: CreateCarelogData = {
        franchisor_id: 1,
        caregiver_id: 1,

        start_datetime: new Date('2024-01-15T09:00:00'),
        end_datetime: new Date('2024-01-15T17:00:00'),
        status: CarelogStatus.SCHEDULED,
        documentation: 'Test visit for comprehensive care'
      };
      
      console.log('Testing createCarelog...');
      // Note: This might fail if foreign key data doesn't exist
      // const newCarelog = await carelogsService.createCarelog(newCarelogData);
      // console.log(`Created carelog with ID: ${newCarelog.id}`);
      console.log('Carelog creation test skipped (requires valid foreign key data)');
    } catch (error) {
      console.log('Carelog creation test failed (expected if no sample data):', error.message);
    }
    
  } catch (error) {
    console.error('CarelogsService test failed:', error);
  }
}

// Test data insertion (sample data for testing)
async function insertSampleData() {
  console.log('\nInserting sample data for testing...');
  
  const carelogsRepository = new CarelogsRepository(knexInstance);
  
  try {
    // This would typically be done through proper seeding
    console.log('Sample data insertion would be implemented here');
    console.log('For production, use proper database seeding with migration files');
  } catch (error) {
    console.error('Sample data insertion failed:', error);
  }
}

// Run comprehensive tests
async function runTests() {
  console.log('=== Carelogs Module Comprehensive Tests ===\n');
  
  await testCarelogsRepository();
  await testCarelogsService();
  await insertSampleData();
  
  // Close database connection
  await knexInstance.destroy();
  console.log('\n=== Tests completed! ===');
}

// Export for use in other test files
export { testCarelogsRepository, testCarelogsService };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}