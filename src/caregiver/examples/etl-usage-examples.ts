/**
 * ETL Pipeline Usage Examples for CaregiverRepository
 * 
 * This file demonstrates how to use the new ETL pipeline functionality
 * for extracting, transforming, and loading caregiver data from various sources.
 */

import { CaregiverRepository } from '../repositories/CaregiverRepository';
import { knex } from '../../infrastructure/database/connection';

// Initialize repository
const caregiverRepo = new CaregiverRepository(knex);

/**
 * Example 1: Load data from CSV file
 */
export async function loadFromCSV() {
  try {
    await caregiverRepo.runETLPipeline({
      type: 'csv',
      path: './data/caregivers.csv'
    }, {
      batchSize: 100,
      validateOnly: false // Set to true to validate without inserting
    });
    
    console.log('CSV ETL pipeline completed successfully!');
  } catch (error) {
    console.error('CSV ETL pipeline failed:', error);
  }
}

/**
 * Example 2: Load data from API endpoint
 */
export async function loadFromAPI() {
  try {
    await caregiverRepo.runETLPipeline({
      type: 'api',
      url: 'https://api.example.com/caregivers',
      headers: {
        'Authorization': 'Bearer your-token-here',
        'Content-Type': 'application/json'
      }
    }, {
      batchSize: 50
    });
    
    console.log('API ETL pipeline completed successfully!');
  } catch (error) {
    console.error('API ETL pipeline failed:', error);
  }
}

/**
 * Example 3: Load data from another database
 */
export async function loadFromDatabase() {
  try {
    await caregiverRepo.runETLPipeline({
      type: 'database',
      query: `
        SELECT 
          franchisor_id,
          agency_id,
          first_name,
          last_name,
          email,
          phone_number,
          status,
          external_id
        FROM legacy_caregivers 
        WHERE status = 'active'
      `
      // sourceKnex: otherDatabaseConnection // Optional: use different DB connection
    }, {
      batchSize: 75
    });
    
    console.log('Database ETL pipeline completed successfully!');
  } catch (error) {
    console.error('Database ETL pipeline failed:', error);
  }
}

/**
 * Example 4: Validate data without loading (dry run)
 */
export async function validateDataOnly() {
  try {
    await caregiverRepo.runETLPipeline({
      type: 'csv',
      path: './data/caregivers.csv'
    }, {
      validateOnly: true // This will only validate, not insert
    });
    
    console.log('Data validation completed successfully!');
  } catch (error) {
    console.error('Data validation failed:', error);
  }
}

/**
 * Example 5: Using individual ETL methods for custom workflows
 */
export async function customETLWorkflow() {
  try {
    // EXTRACT
    console.log('Extracting data...');
    const rawData = await caregiverRepo.extractFromCSV('./data/caregivers.csv');
    
    // Custom filtering before transformation
    const filteredData = rawData.filter(record => 
      record.status === 'active' && record.email && record.first_name
    );
    
    // TRANSFORM
    console.log('Transforming data...');
    const transformedData = caregiverRepo.transformCaregiverData(filteredData);
    
    // Custom validation or additional transformations
    const validatedData = transformedData.filter(record => 
      record.email && record.first_name && record.last_name
    );
    
    // LOAD
    console.log('Loading data...');
    await caregiverRepo.loadCaregiverData(validatedData, 25);
    
    console.log('Custom ETL workflow completed successfully!');
  } catch (error) {
    console.error('Custom ETL workflow failed:', error);
  }
}

/**
 * Example 6: Legacy method (backward compatibility)
 */
export async function useLegacyMethod() {
  try {
    // This still works but uses the new ETL pipeline under the hood
    await caregiverRepo.insertData();
    
    console.log('Legacy method completed successfully!');
  } catch (error) {
    console.error('Legacy method failed:', error);
  }
}

// Example usage in a script
if (require.main === module) {
  (async () => {
    try {
      // Choose which example to run
      await loadFromCSV();
      // await loadFromAPI();
      // await loadFromDatabase();
      // await validateDataOnly();
      // await customETLWorkflow();
      // await useLegacyMethod();
    } catch (error) {
      console.error('ETL example failed:', error);
      process.exit(1);
    } finally {
      await knex.destroy();
    }
  })();
}