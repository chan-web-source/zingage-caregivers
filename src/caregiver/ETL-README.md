# Caregiver ETL Pipeline

This document describes the comprehensive ETL (Extract, Transform, Load) pipeline implemented for the `caregivers` table in the Zingage application.

## Overview

The ETL pipeline provides a robust, flexible system for importing caregiver data from various sources including CSV files, APIs, and databases. It includes data validation, transformation, error handling, and batch processing capabilities.

## Features

### Extract Phase
- **CSV Files**: Read data from CSV files with automatic parsing
- **APIs**: Fetch data from REST APIs with custom headers support
- **Databases**: Extract data using custom SQL queries from any database

### Transform Phase
- **Data Cleaning**: Automatic trimming, null handling, and format standardization
- **Validation**: Required field validation and data type checking
- **Normalization**: Gender, status, and other field normalization
- **Email/Phone Validation**: Format validation for contact information
- **Date Parsing**: Flexible date format handling

### Load Phase
- **Batch Processing**: Configurable batch sizes for optimal performance
- **Transaction Safety**: All operations wrapped in database transactions
- **Error Handling**: Individual record error tracking without stopping the entire process
- **Multi-table Insertion**: Proper insertion into `profile`, `external`, and `caregivers` tables

## Architecture

The ETL pipeline follows the new database schema where:
- `caregivers` table references `profile` and `external` tables
- `profile` contains personal and professional information
- `external` contains external system identifiers
- Foreign key relationships ensure data integrity

## Usage

### Basic ETL Pipeline

```typescript
import { CaregiverRepository } from './repositories/CaregiverRepository';
import { knex } from '../infrastructure/database/connection';

const caregiverRepo = new CaregiverRepository(knex);

// Load from CSV
await caregiverRepo.runETLPipeline({
  type: 'csv',
  path: './data/caregivers.csv'
}, {
  batchSize: 100
});

// Load from API
await caregiverRepo.runETLPipeline({
  type: 'api',
  url: 'https://api.example.com/caregivers',
  headers: { 'Authorization': 'Bearer token' }
});

// Load from Database
await caregiverRepo.runETLPipeline({
  type: 'database',
  query: 'SELECT * FROM legacy_caregivers WHERE active = true'
});
```

### Individual ETL Methods

```typescript
// Extract only
const rawData = await caregiverRepo.extractFromCSV('./data/caregivers.csv');

// Transform only
const transformedData = caregiverRepo.transformCaregiverData(rawData);

// Load only
await caregiverRepo.loadCaregiverData(transformedData, 50);
```

### Validation Mode

```typescript
// Validate data without inserting
await caregiverRepo.runETLPipeline({
  type: 'csv',
  path: './data/caregivers.csv'
}, {
  validateOnly: true
});
```

## Data Mapping

The ETL pipeline expects the following fields in source data:

### Required Fields
- `first_name`: Caregiver's first name
- `last_name`: Caregiver's last name

### Optional Fields
- `franchisor_id`: Franchisor identifier
- `agency_id`: Agency identifier
- `location_id` / `locations_id`: Location identifier
- `subdomain`: Subdomain identifier
- `email`: Email address (validated)
- `phone_number`: Phone number (cleaned)
- `gender`: Gender (normalized to standard values)
- `birthday_date`: Birth date (parsed)
- `onboarding_date`: Onboarding date (parsed)
- `certification_level`: Certification level
- `hourly_rate`: Hourly rate (decimal)
- `applicant`: Applicant status (boolean)
- `applicant_status`: Applicant status text
- `status` / `sstatus`: Status (normalized)
- `external_id` / `external_system_id`: External system identifier
- `system_name`: External system name

## Data Transformations

### String Cleaning
- Trims whitespace
- Converts empty strings to null
- Validates required fields

### Email Validation
- Converts to lowercase
- Validates email format using regex
- Invalid emails are set to null with warning

### Phone Number Cleaning
- Removes all non-digit characters except leading +
- Preserves international format

### Gender Normalization
- Maps common variations to standard values:
  - `m`, `male` → `male`
  - `f`, `female` → `female`
  - Others → `other`

### Status Normalization
- Maps various status values to standard enum values
- Defaults to `active` for unknown values

### Date Parsing
- Flexible date format parsing
- Invalid dates are set to null

## Error Handling

### Record-Level Errors
- Individual record failures don't stop the entire process
- Errors are logged with row numbers for easy debugging
- Summary report shows success/failure counts

### Transaction Safety
- All database operations are wrapped in transactions
- Rollback on critical failures
- Batch processing for memory efficiency

### Validation Errors
- Missing required fields are caught during transformation
- Data type validation prevents database errors
- Detailed error messages for debugging

## Performance Considerations

### Batch Processing
- Configurable batch sizes (default: 50)
- Memory-efficient streaming for large datasets
- Progress logging for long-running operations

### Database Optimization
- Single transaction per batch
- Efficient foreign key lookups
- Minimal database round trips

## Migration from Legacy System

The legacy `insertData()` method is still available for backward compatibility but now uses the new ETL pipeline internally:

```typescript
// Legacy method (still works)
await caregiverRepo.insertData();

// Equivalent new method
await caregiverRepo.runETLPipeline({
  type: 'csv',
  path: 'caregiver_data_20250415_sanitized.csv'
}, {
  batchSize: 50
});
```

## Examples

See `src/caregiver/examples/etl-usage-examples.ts` for comprehensive usage examples including:
- CSV file processing
- API data extraction
- Database migration
- Custom workflows
- Validation-only runs

## Error Codes and Troubleshooting

### Common Issues

1. **Missing Required Fields**
   - Error: "Missing required fields in row X: first_name, last_name"
   - Solution: Ensure source data has required fields

2. **Invalid Email Format**
   - Warning: "Invalid email format: invalid-email"
   - Solution: Clean source data or accept null emails

3. **Database Connection Issues**
   - Error: "Failed to extract data from database"
   - Solution: Check database connection and query syntax

4. **File Not Found**
   - Error: "ENOENT: no such file or directory"
   - Solution: Verify file path and permissions

### Best Practices

1. **Always validate first**: Use `validateOnly: true` before running full ETL
2. **Use appropriate batch sizes**: Larger batches for better performance, smaller for memory constraints
3. **Monitor logs**: Check console output for warnings and errors
4. **Handle duplicates**: Ensure source data doesn't contain duplicate external IDs
5. **Backup before loading**: Always backup production data before running ETL

## Future Enhancements

- Support for Excel files
- Real-time data streaming
- Data deduplication
- Incremental updates
- Data quality metrics
- Automated scheduling