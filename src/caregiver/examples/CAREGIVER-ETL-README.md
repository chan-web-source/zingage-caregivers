# Caregiver ETL Pipeline Implementation

## Overview

This document provides an overview of the ETL (Extract, Transform, Load) pipeline implementation for the `caregivers` table in the Zingage application. The ETL pipeline is designed to handle data from various sources, transform it according to business rules, and load it into the database with proper error handling and reporting.

## Pipeline Components

The ETL pipeline consists of three main phases:

### 1. Extract Phase

The extract phase retrieves data from various sources:

- **CSV Files**: Reads data from CSV files with automatic parsing
- **APIs**: Fetches data from REST APIs with custom headers support
- **Databases**: Extracts data using custom SQL queries from any database

Implemented methods:
- `extractFromCSV(filePath: string): Promise<any[]>`
- `extractFromAPI(apiUrl: string, headers?: Record<string, string>): Promise<any[]>`
- `extractFromDatabase(query: string, sourceKnex?: Knex): Promise<any[]>`

### 2. Transform Phase

The transform phase cleans, validates, and normalizes the data:

- **Data Cleaning**: Automatic trimming, null handling, and format standardization
- **Validation**: Required field validation and data type checking
- **Normalization**: Gender, status, and other field normalization
- **Email/Phone Validation**: Format validation for contact information
- **Date Parsing**: Flexible date format handling

Implemented methods:
- `transformCaregiverData(rawData: any[]): any[]`
- Various helper methods for cleaning and validation

### 3. Load Phase

The load phase inserts the transformed data into the database:

- **Batch Processing**: Configurable batch sizes for optimal performance
- **Transaction Safety**: All operations wrapped in database transactions
- **Error Handling**: Individual record error tracking without stopping the entire process
- **Multi-table Insertion**: Proper insertion into `profile`, `external`, and `caregivers` tables

Implemented methods:
- `loadCaregiverData(transformedData: any[], batchSize: number): Promise<{ totalProcessed: number; successCount: number; errorCount: number; errors: any[]; }>`
- `insertSingleCaregiver(record: any, trx: Knex.Transaction): Promise<void>`

## Complete Pipeline

The complete ETL pipeline is orchestrated by the `runETLPipeline` method, which handles all three phases with comprehensive error handling, retries, and reporting.

```typescript
runETLPipeline(source: {
  type: 'csv' | 'api' | 'database';
  path?: string;
  url?: string;
  query?: string;
  headers?: Record<string, string>;
  sourceKnex?: Knex;
}, options: {
  batchSize?: number;
  validateOnly?: boolean;
  continueOnError?: boolean;
  maxRetries?: number;
}): Promise<{
  success: boolean;
  extractedCount: number;
  transformedCount: number;
  loadResult?: any;
  errors: any[];
  duration: number;
}>
```

## Usage Examples

See the `caregiver-etl-implementation.ts` file for comprehensive usage examples including:

- CSV file processing
- API data extraction
- Database migration
- Using individual ETL methods

## Data Mapping

The ETL pipeline maps source data to the following database tables:

### Profile Table
- `franchisor_id`: Franchisor identifier
- `agency_id`: Agency identifier
- `location_id`: Location identifier
- `subdomain`: Subdomain identifier
- `first_name`: Caregiver's first name (required)
- `last_name`: Caregiver's last name (required)
- `email`: Email address (validated)
- `phone_number`: Phone number (cleaned)
- `gender`: Gender (normalized)
- `birthday_date`: Birth date (parsed)
- `onboarding_date`: Onboarding date (parsed)
- `certification_level`: Certification level
- `hourly_rate`: Hourly rate (decimal)
- `applicant`: Applicant status (boolean)
- `applicant_status`: Applicant status text
- `sstatus`: Status (normalized)

### External Table
- `external_id`: External system identifier
- `system_name`: External system name

### Caregivers Table
- `franchisor_id`: Franchisor identifier
- `agency_id`: Agency identifier
- `profile_id`: Reference to profile table
- `external_id`: Reference to external table
- `applicant_status`: Applicant status
- `status`: Caregiver status

## Error Handling

The ETL pipeline includes comprehensive error handling:

- **Record-Level Errors**: Individual record failures don't stop the entire process
- **Transaction Safety**: All database operations are wrapped in transactions
- **Validation Errors**: Missing required fields are caught during transformation
- **Retry Logic**: Configurable retries for extraction failures
- **Detailed Reporting**: Comprehensive error reporting with categorization

## Performance Considerations

- **Batch Processing**: Configurable batch sizes (default: 50)
- **Memory Efficiency**: Streaming for large datasets
- **Progress Logging**: Detailed logging for long-running operations
- **Timeout Protection**: Individual record timeout protection
- **Small Delays**: Small delays between batches to prevent overwhelming the database