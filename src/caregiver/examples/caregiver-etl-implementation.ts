import { CaregiverRepository } from '../repositories/CaregiverRepository';
import { knex } from '../../infrastructure/database/connection';

/**
 * This file demonstrates how to use the ETL pipeline for the caregivers table.
 * It shows examples of extracting data from different sources, transforming it,
 * and loading it into the database.
 */

async function runCaregiverETLExamples() {
  const caregiverRepo = new CaregiverRepository(knex);
  
  console.log('=== CAREGIVER ETL PIPELINE EXAMPLES ===');
  
  // Example 1: Extract from CSV
  try {
    console.log('\n1. Running ETL from CSV source');
    const csvResult = await caregiverRepo.runETLPipeline({
      type: 'csv',
      path: './data/caregivers_sample.csv'
    }, {
      batchSize: 50,
      continueOnError: true
    });
    
    console.log(`CSV ETL Result: ${csvResult.success ? 'Success' : 'Failed'}`);
    console.log(`- Records extracted: ${csvResult.extractedCount}`);
    console.log(`- Records transformed: ${csvResult.transformedCount}`);
    if (csvResult.loadResult) {
      console.log(`- Records loaded: ${csvResult.loadResult.successCount}`);
      console.log(`- Load errors: ${csvResult.loadResult.errorCount}`);
    }
  } catch (error) {
    console.error('CSV ETL failed:', error.message);
  }
  
  // Example 2: Extract from API
  try {
    console.log('\n2. Running ETL from API source');
    const apiResult = await caregiverRepo.runETLPipeline({
      type: 'api',
      url: 'https://api.example.com/caregivers',
      headers: { 'Authorization': 'Bearer sample-token' }
    }, {
      validateOnly: true // Only validate, don't insert
    });
    
    console.log(`API ETL Validation: ${apiResult.success ? 'Success' : 'Failed'}`);
    console.log(`- Records that would be extracted: ${apiResult.extractedCount}`);
    console.log(`- Records that would be transformed: ${apiResult.transformedCount}`);
  } catch (error) {
    console.error('API ETL failed:', error.message);
  }
  
  // Example 3: Extract from Database
  try {
    console.log('\n3. Running ETL from Database source');
    const dbResult = await caregiverRepo.runETLPipeline({
      type: 'database',
      query: 'SELECT * FROM legacy_caregivers WHERE active = true LIMIT 100'
    }, {
      batchSize: 25,
      maxRetries: 2
    });
    
    console.log(`Database ETL Result: ${dbResult.success ? 'Success' : 'Failed'}`);
    console.log(`- Records extracted: ${dbResult.extractedCount}`);
    console.log(`- Records transformed: ${dbResult.transformedCount}`);
    if (dbResult.loadResult) {
      console.log(`- Records loaded: ${dbResult.loadResult.successCount}`);
      console.log(`- Load errors: ${dbResult.loadResult.errorCount}`);
    }
  } catch (error) {
    console.error('Database ETL failed:', error.message);
  }
  
  // Example 4: Using individual ETL methods
  try {
    console.log('\n4. Using individual ETL methods');
    
    // Extract
    const rawData = await caregiverRepo.extractFromCSV('./data/caregivers_sample.csv');
    console.log(`- Extracted ${rawData.length} records`);
    
    // Transform
    const transformedData = caregiverRepo.transformCaregiverData(rawData);
    console.log(`- Transformed ${transformedData.length} records`);
    
    // Load (validate only)
    console.log('- Skipping load phase for this example');
  } catch (error) {
    console.error('Individual ETL methods failed:', error.message);
  }
  
  console.log('\n=== ETL EXAMPLES COMPLETED ===');
}

// Run the examples
runCaregiverETLExamples().catch(error => {
  console.error('Error running examples:', error);
  process.exit(1);
});