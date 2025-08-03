import { Knex } from 'knex';
import { Carelogs } from '../models/carelogs';
import * as fs from 'fs';
import csv from 'csv-parser';
import * as path from 'path';
import axios from 'axios';

// Transform interfaces for ETL pipeline
interface Transform {
  success: boolean;
  data?: any;
  error?: string;
  rowIndex?: number;
}

interface ETLResult {
  success: boolean;
  extractedCount: number;
  transformedCount: number;
  loadedCount: number;
  errorCount: number;
  errors: string[];
  loadResults?: LoadResult;
  duration: number;
}

interface LoadResult {
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    rowIndex: number;
    error: string;
    data?: any;
  }>;
  summary: {
    insertionRate: number;
    errorRate: number;
    avgProcessingTime: number;
    errorsByType: Record<string, number>;
  };
}

/**
 * Repository for managing carelog data operations
 * Handles CRUD operations and analytics for care visit logs
 */
export class CarelogsRepository {
  constructor(private readonly knex: Knex) { }

  // ===== ETL PIPELINE METHODS =====

  /**
   * EXTRACT: Read raw data from CSV file
   */
  async extractFromCSV(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      let rowCount = 0;

      if (!fs.existsSync(filePath)) {
        reject(new Error(`CSV file not found: ${filePath}`));
        return;
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          rowCount++;
          results.push({ ...data, _rowIndex: rowCount });
        })
        .on('end', () => {
          console.log(`✓ Extracted ${results.length} rows from CSV`);
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`CSV extraction failed: ${error.message}`));
        });
    });
  }

  /**
   * EXTRACT: Fetch data from API endpoint
   */
  async extractFromAPI(apiUrl: string, headers?: Record<string, string>): Promise<any[]> {
    try {
      const response = await axios.get(apiUrl, { headers });
      const data = Array.isArray(response.data) ? response.data : [response.data];
      console.log(`✓ Extracted ${data.length} records from API`);
      return data.map((item, index) => ({ ...item, _rowIndex: index + 1 }));
    } catch (error) {
      throw new Error(`API extraction failed: ${error.message}`);
    }
  }

  /**
   * EXTRACT: Query data from database
   */
  async extractFromDatabase(query: string, sourceKnex?: Knex): Promise<any[]> {
    try {
      const db = sourceKnex || this.knex;
      const results = await db.raw(query);
      const data = results.rows || results;
      console.log(`✓ Extracted ${data.length} records from database`);
      return data.map((item, index) => ({ ...item, _rowIndex: index + 1 }));
    } catch (error) {
      throw new Error(`Database extraction failed: ${error.message}`);
    }
  }

  /**
   * TRANSFORM: Clean, validate and format carelog data
   */
  async transformCarelogData(rawData: any[]): Promise<Transform[]> {
    const results: Transform[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowIndex = row._rowIndex || i + 1;

      try {
        // Validate required fields
        if (!row.caregiver_id || !row.start_datetime || !row.end_datetime) {
          throw new Error('Missing required fields: caregiver_id, start_datetime, end_datetime');
        }

        const transformedData: Partial<Carelogs> = {
          franchisor_id: this.parseInteger(row.franchisor_id),
          agency_id: this.parseInteger(row.agency_id),
          external_id: this.cleanString(row.id || row.external_id),
          caregiver_id: this.parseInteger(row.caregiver_id),
          parent_id: this.parseInteger(row.parent_id),
          start_datetime: this.parseDate(row.start_datetime),
          end_datetime: this.parseDate(row.end_datetime),
          clock_in_actual_datetime: this.parseDate(row.clock_in_actual_datetime),
          clock_out_actual_datetime: this.parseDate(row.clock_out_actual_datetime),
          clock_in_method: this.cleanString(row.clock_in_method),
          clock_out_method: this.cleanString(row.clock_out_method),
          status: this.normalizeCarelogStatus(row.status),
          split: this.parseBoolean(row.split),
          documentation: this.cleanString(row.documentation) || '',
          general_comment_char_count: this.parseInteger(row.general_comment_char_count) || 0,
          created_at: new Date(),
          updated_at: new Date()
        };

        // Business rule validations
        const validation = this.validateCarelogRecord(transformedData);
        if (!validation.isValid) {
          throw new Error(validation.errors.join('; '));
        }

        results.push({
          success: true,
          data: transformedData,
          rowIndex
        });
        successCount++;
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          rowIndex
        });
        errorCount++;
        console.warn(`Row ${rowIndex}: ${error.message}`);
      }
    }

    console.log(`✓ Transform completed: ${successCount} success, ${errorCount} errors`);
    return results;
  }

  /**
   * Helper: Clean and trim string values
   */
  private cleanString(value: any): string | null {
    if (value === null || value === undefined) return null;
    const cleaned = String(value).trim();
    return cleaned === '' ? null : cleaned;
  }

  /**
   * Helper: Parse integer values safely
   */
  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(String(value).trim());
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Helper: Parse date values safely
   */
  private parseDate(value: any): Date | null {
    if (!value || String(value).trim() === '') return null;
    const parsed = new Date(String(value).trim());
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Helper: Parse boolean values safely
   */
  private parseBoolean(value: any): boolean {
    if (value === null || value === undefined) return false;
    const str = String(value).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes';
  }

  /**
   * Helper: Normalize carelog status values
   */
  private normalizeCarelogStatus(status: any): string {
    if (!status) return 'scheduled';
    const normalized = String(status).toLowerCase().trim();
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show', 'deleted'];
    return validStatuses.includes(normalized) ? normalized : 'scheduled';
  }

  /**
   * Helper: Validate carelog record business rules
   */
  private validateCarelogRecord(carelog: Partial<Carelogs>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required field validation
    if (!carelog.caregiver_id) errors.push('caregiver_id is required');
    if (!carelog.start_datetime) errors.push('start_datetime is required');
    if (!carelog.end_datetime) errors.push('end_datetime is required');

    // Date logic validation
    if (carelog.start_datetime && carelog.end_datetime) {
      if (carelog.start_datetime >= carelog.end_datetime) {
        errors.push('start_datetime must be before end_datetime');
      }
    }

    // Actual time validation
    if (carelog.clock_in_actual_datetime && carelog.clock_out_actual_datetime) {
      if (carelog.clock_in_actual_datetime >= carelog.clock_out_actual_datetime) {
        errors.push('clock_in_actual_datetime must be before clock_out_actual_datetime');
      }
    }

    // Character count validation
    if (carelog.general_comment_char_count && carelog.general_comment_char_count < 0) {
      errors.push('general_comment_char_count cannot be negative');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * LOAD: Insert transformed carelog data with comprehensive error handling
   */
  async loadCarelogData(transformedData: Transform[], batchSize: number = 50): Promise<LoadResult> {
    const startTime = Date.now();
    const errors: Array<{ rowIndex: number; error: string; data?: any }> = [];
    let successCount = 0;
    const errorsByType: Record<string, number> = {};

    // Filter successful transformations
    const validData = transformedData.filter(t => t.success && t.data);
    269: console.log(`Loading ${validData.length} valid records in batches of ${batchSize}`);

    try {
      await this.knex.transaction(async (trx) => {
        for (let i = 0; i < validData.length; i += batchSize) {
          const batch = validData.slice(i, i + batchSize);
          275: console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validData.length / batchSize)}`);

          for (const transform of batch) {
            try {
              // Add timeout protection
              const insertPromise = this.insertSingleCarelog(transform.data!, trx);
              const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Insert timeout')), 10000)
              );

              await Promise.race([insertPromise, timeoutPromise]);
              successCount++;
            } catch (error) {
              const errorType = this.categorizeError(error.message);
              errorsByType[errorType] = (errorsByType[errorType] || 0) + 1;

              errors.push({
                rowIndex: transform.rowIndex || 0,
                error: error.message,
                data: transform.data
              });
              console.warn(`❌ Row ${transform.rowIndex}: ${error.message}`);
            }
          }

          // Small delay between batches to prevent overwhelming the database
          if (i + batchSize < validData.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      });
    } catch (transactionError) {
      throw new Error(`Transaction failed: ${transactionError.message}`);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const totalProcessed = validData.length;
    const errorCount = errors.length;

    const result: LoadResult = {
      totalProcessed,
      successCount,
      errorCount,
      errors,
      summary: {
        insertionRate: totalProcessed > 0 ? (successCount / totalProcessed) * 100 : 0,
        errorRate: totalProcessed > 0 ? (errorCount / totalProcessed) * 100 : 0,
        avgProcessingTime: totalProcessed > 0 ? duration / totalProcessed : 0,
        errorsByType
      }
    };

    console.log(`✅ Load completed: ${successCount}/${totalProcessed} successful (${result.summary.insertionRate.toFixed(1)}%)`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} errors occurred during loading`);
    }

    return result;
  }

  /**
   * Helper: Insert single carelog with validation
   */
  private async insertSingleCarelog(carelogData: Partial<Carelogs>, trx: Knex.Transaction): Promise<void> {
    // Validate required fields
    if (!carelogData.caregiver_id) {
      throw new Error('Missing required field: caregiver_id');
    }
    if (!carelogData.start_datetime) {
      throw new Error('Missing required field: start_datetime');
    }
    if (!carelogData.end_datetime) {
      throw new Error('Missing required field: end_datetime');
    }

    // Validate foreign key references
    if (carelogData.caregiver_id) {
      const caregiverExists = await trx('caregivers')
        .where('id', carelogData.caregiver_id)
        .first();
      if (!caregiverExists) {
        throw new Error(`Caregiver with ID ${carelogData.caregiver_id} does not exist`);
      }
    }

    if (carelogData.parent_id) {
      const parentExists = await trx('profile')
        .where('id', carelogData.parent_id)
        .first();
      if (!parentExists) {
        throw new Error(`Parent with ID ${carelogData.parent_id} does not exist`);
      }
    }

    // Check for duplicate external_id if provided
    if (carelogData.external_id) {
      const existingCarelog = await trx('carelogs')
        .where('external_id', carelogData.external_id)
        .first();
      if (existingCarelog) {
        throw new Error(`Carelog with external_id '${carelogData.external_id}' already exists`);
      }
    }

    try {
      await trx('carelogs').insert(carelogData);
    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        throw new Error('Duplicate carelog record');
      } else if (error.code === '23503') { // Foreign key constraint violation
        throw new Error('Invalid foreign key reference');
      } else {
        throw new Error(`Database insertion failed: ${error.message}`);
      }
    }
  }

  /**
   * Helper: Categorize errors for reporting
   */
  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('does not exist')) return 'Foreign Key Error';
    if (errorMessage.includes('already exists')) return 'Duplicate Error';
    if (errorMessage.includes('Missing required')) return 'Validation Error';
    if (errorMessage.includes('timeout')) return 'Timeout Error';
    if (errorMessage.includes('Database insertion')) return 'Database Error';
    return 'Unknown Error';
  }

  /**
   * ETL PIPELINE ORCHESTRATOR: Run complete Extract-Transform-Load process
   */
  async runETLPipeline(source: {
    type: 'csv' | 'api' | 'database';
    path?: string;
    url?: string;
    headers?: Record<string, string>;
    query?: string;
    sourceKnex?: Knex;
  }, options: {
    batchSize?: number;
    validateOnly?: boolean;
  } = {}): Promise<ETLResult> {
    const startTime = Date.now();
    const { batchSize = 50, validateOnly = false } = options;
    let rawData: any[] = [];
    let transformResults: Transform[] = [];
    let loadResults: LoadResult | undefined;
    const errors: string[] = [];

    try {
      console.log(`🚀 Starting ETL pipeline for carelogs (${source.type} source)`);

      // EXTRACT with retry logic
      let extractAttempts = 0;
      const maxExtractAttempts = 3;

      while (extractAttempts < maxExtractAttempts) {
        try {
          switch (source.type) {
            case 'csv':
              if (!source.path) throw new Error('CSV path is required');
              rawData = await this.extractFromCSV(source.path);
              break;
            case 'api':
              if (!source.url) throw new Error('API URL is required');
              rawData = await this.extractFromAPI(source.url, source.headers);
              break;
            case 'database':
              if (!source.query) throw new Error('Database query is required');
              rawData = await this.extractFromDatabase(source.query, source.sourceKnex);
              break;
            default:
              throw new Error(`Unsupported source type: ${source.type}`);
          }
          break; // Success, exit retry loop
        } catch (error) {
          extractAttempts++;
          if (extractAttempts >= maxExtractAttempts) {
            throw new Error(`Extract failed after ${maxExtractAttempts} attempts: ${error.message}`);
          }
          console.warn(`Extract attempt ${extractAttempts} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * extractAttempts));
        }
      }

      // TRANSFORM
      transformResults = await this.transformCarelogData(rawData);
      const transformErrors = transformResults.filter(r => !r.success);
      transformErrors.forEach(error => {
        errors.push(`Row ${error.rowIndex}: ${error.error}`);
      });

      // LOAD (unless validation only)
      if (!validateOnly) {
        loadResults = await this.loadCarelogData(transformResults, batchSize);
        loadResults.errors.forEach(error => {
          errors.push(`Load error row ${error.rowIndex}: ${error.error}`);
        });
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      const result: ETLResult = {
        success: errors.length === 0 || (loadResults ? loadResults.successCount > 0 : transformResults.some(r => r.success)),
        extractedCount: rawData.length,
        transformedCount: transformResults.filter(r => r.success).length,
        loadedCount: loadResults ? loadResults.successCount : 0,
        errorCount: errors.length,
        errors,
        loadResults,
        duration
      };

      console.log(`🎯 ETL Pipeline completed in ${duration}ms`);
      console.log(`📊 Results: ${result.extractedCount} extracted, ${result.transformedCount} transformed, ${result.loadedCount} loaded`);

      if (result.errorCount > 0) {
        console.log(`⚠️  ${result.errorCount} errors encountered`);
      }

      return result;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      console.error(`❌ ETL Pipeline failed: ${error.message}`);

      return {
        success: false,
        extractedCount: rawData.length,
        transformedCount: transformResults.filter(r => r.success).length,
        loadedCount: 0,
        errorCount: errors.length + 1,
        errors: [...errors, error.message],
        duration
      };
    }
  }

  /**
   * Get standardized select fields for carelogs with proper joins
   */
  private getCarelogSelectFields() {
    return [
      'carelogs.id',
      'carelogs.franchisor_id',
      'carelogs.agency_id',
      'carelogs.external_id',
      'carelogs.caregiver_id',
      'carelogs.parent_id',
      'carelogs.start_datetime',
      'carelogs.end_datetime',
      'carelogs.clock_in_actual_datetime',
      'carelogs.clock_out_actual_datetime',
      'carelogs.clock_in_method',
      'carelogs.clock_out_method',
      'carelogs.status',
      'carelogs.split',
      'carelogs.documentation',
      'carelogs.general_comment_char_count',
      'carelogs.created_at',
      'carelogs.updated_at',
      // Join related data from profile table through caregivers
      this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
      'profile.email as caregiver_email',
      'profile.phone_number as caregiver_phone',
      'profile.certification_level',
      'external.external_id as caregiver_external_id',
      'franchisors.name as franchisor_name',
      'agencies.name as agency_name'
    ];
  }

  /**
   * Insert carelog data from CSV file (legacy-style ETL entrypoint)
   * @deprecated Use runETLPipeline for more flexibility
   * This method provides a simple interface for legacy compatibility
   */
  async insertData(): Promise<void> {
    const csvFilePath = 'carelog_data_20250415_sanitized.csv';
    try {
      console.log('=== LEGACY INSERT DATA METHOD ===');
      console.log('⚠ This method is deprecated. Consider using runETLPipeline for better control.');
      const result = await this.runETLPipeline({
        type: 'csv',
        path: csvFilePath
      }, {
        batchSize: 50
      });
      // Log summary for legacy compatibility
      console.log('\n=== LEGACY METHOD SUMMARY ===');
      console.log(`✓ Pipeline success: ${result.success}`);
      console.log(`✓ Records extracted: ${result.extractedCount}`);
      console.log(`✓ Records transformed: ${result.transformedCount}`);
      if (result.loadResults) {
        console.log(`✓ Records loaded: ${result.loadResults.successCount}`);
        console.log(`✓ Load errors: ${result.loadResults.errorCount}`);
      }
      console.log(`✓ Total duration: ${(result.duration / 1000).toFixed(2)} seconds`);
      if (!result.success && result.errors.some(e => e.includes('extract'))) {
        throw new Error(`Critical ETL failure: ${result.errors.find(e => e.includes('extract'))}`);
      }
      if (result.errors.length > 0) {
        console.warn(`⚠ Pipeline completed with ${result.errors.length} errors`);
      }
    } catch (error) {
      console.error('\n=== LEGACY INSERT DATA FAILED ===');
      console.error(`✗ Error: ${error.message}`);
      if (error.message.includes('CSV file not found')) {
        console.error('💡 Tip: Make sure the CSV file exists in the correct location');
        console.error(`💡 Expected path: ${csvFilePath}`);
      } else if (error.message.includes('database')) {
        console.error('💡 Tip: Check database connection and table schemas');
      } else if (error.message.includes('transform')) {
        console.error('💡 Tip: Check CSV data format and required fields');
      }
      throw new Error(`Legacy insertData method failed: ${error.message}`);
    }
  }

  /**
   * Get standardized select fields for carelogs with proper joins
   */
  private getCarelogSelectFields() {
    return [
      'carelogs.id',
      'carelogs.franchisor_id',
      'carelogs.agency_id',
      'carelogs.external_id',
      'carelogs.caregiver_id',
      'carelogs.parent_id',
      'carelogs.start_datetime',
      'carelogs.end_datetime',
      'carelogs.clock_in_actual_datetime',
      'carelogs.clock_out_actual_datetime',
      'carelogs.clock_in_method',
      'carelogs.clock_out_method',
      'carelogs.status',
      'carelogs.split',
      'carelogs.documentation',
      'carelogs.general_comment_char_count',
      'carelogs.created_at',
      'carelogs.updated_at',
      // Join related data from profile table through caregivers
      this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
      'profile.email as caregiver_email',
      'profile.phone_number as caregiver_phone',
      'profile.certification_level',
      'external.external_id as caregiver_external_id',
      'franchisors.name as franchisor_name',
      'agencies.name as agency_name'
    ];
  }

  /**
   * Insert carelog data from CSV file
   * @deprecated Use runETLPipeline instead for more flexibility
   * This method specifically handles carelog data, not caregiver data
   */
  async insertCarelogData(csvFilePath?: string): Promise<void> {
    const filePath = csvFilePath || path.join(__dirname, '../../data/carelog_data.csv');

    console.log('⚠ This method is deprecated. Consider using runETLPipeline for better control.');

    try {
      const result = await this.runETLPipeline({
        type: 'csv',
        path: filePath
      }, {
        batchSize: 50
      });

      // Handle results with comprehensive error reporting
      console.log('\n📊 ETL Pipeline Summary:');
      console.log(`✅ Successfully processed: ${result.loadedCount}/${result.extractedCount} records`);
      console.log(`⏱️  Total processing time: ${result.duration}ms`);

      if (result.loadResults) {
        const { summary } = result.loadResults;
        console.log(`📈 Success rate: ${summary.insertionRate.toFixed(1)}%`);
        console.log(`⚡ Average processing time per record: ${summary.avgProcessingTime.toFixed(2)}ms`);

        if (Object.keys(summary.errorsByType).length > 0) {
          console.log('\n🔍 Error breakdown:');
          Object.entries(summary.errorsByType).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} errors`);
          });
        }
      }

      if (result.errorCount > 0) {
        console.log(`\n⚠️  ${result.errorCount} errors encountered:`);
        result.errors.slice(0, 10).forEach(error => console.log(`  • ${error}`));
        if (result.errors.length > 10) {
          console.log(`  ... and ${result.errors.length - 10} more errors`);
        }

        // Provide helpful tips for common errors
        const hasValidationErrors = result.errors.some(e => e.includes('Missing required'));
        const hasForeignKeyErrors = result.errors.some(e => e.includes('does not exist'));
        const hasDuplicateErrors = result.errors.some(e => e.includes('already exists'));

        if (hasValidationErrors) {
          console.log('\n💡 Tip: Check your CSV for missing required fields (caregiver_id, start_datetime, end_datetime)');
        }
        if (hasForeignKeyErrors) {
          console.log('💡 Tip: Ensure all caregiver_id and parent_id values exist in their respective tables');
        }
        if (hasDuplicateErrors) {
          console.log('💡 Tip: Check for duplicate external_id values in your data');
        }
      }

      // Only throw error if extraction failed completely
      if (!result.success && result.extractedCount === 0) {
        throw new Error(`ETL pipeline failed: ${result.errors.join('; ')}`);
      }

      if (result.loadedCount === 0 && result.extractedCount > 0) {
        console.log('\n⚠️  Warning: No records were successfully loaded. Please check the error details above.');
      }

    } catch (error) {
      console.error('❌ Critical error in carelog data insertion:', error.message);
      throw error;
    }
  }

  /**
   * Find all carelogs with pagination and filtering
   */
  async findAll(options: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    status?: string;
    caregiver_id?: number;
    franchisor_id?: number;
    agency_id?: number;
  } = {}): Promise<Carelogs[]> {
    try {
      const {
        limit = 50,
        offset = 0,
        orderBy = 'start_datetime',
        orderDirection = 'desc',
        status,
        caregiver_id,
        franchisor_id,
        agency_id
      } = options;

      // Validate parameters
      if (limit < 1 || limit > 1000) {
        throw new Error('Limit must be between 1 and 1000');
      }
      if (offset < 0) {
        throw new Error('Offset must be non-negative');
      }

      let query = this.knex('carelogs')
        .select(this.getCarelogSelectFields())
        .leftJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .leftJoin('profile', 'caregivers.profile_id', 'profile.id')
        .leftJoin('external', 'caregivers.external_id', 'external.id')
        .leftJoin('franchisors', 'carelogs.franchisor_id', 'franchisors.id')
        .leftJoin('agencies', 'carelogs.agency_id', 'agencies.id')
        .orderBy(`carelogs.${orderBy}`, orderDirection)
        .limit(limit)
        .offset(offset);

      // Apply filters
      if (status) {
        query = query.where('carelogs.status', status);
      }
      if (caregiver_id) {
        query = query.where('carelogs.caregiver_id', caregiver_id);
      }
      if (franchisor_id) {
        query = query.where('carelogs.franchisor_id', franchisor_id);
      }
      if (agency_id) {
        query = query.where('carelogs.agency_id', agency_id);
      }

      return await query;
    } catch (error) {
      console.error('Error in CarelogsRepository.findAll:', error);
      throw new Error(`Failed to fetch carelogs: ${error.message}`);
    }
  }

  /**
   * Find carelog by ID with related data
   */
  async findById(id: number): Promise<Carelogs | null> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid ID provided');
      }

      const carelog = await this.knex('carelogs')
        .select(this.getCarelogSelectFields())
        .leftJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .leftJoin('profile', 'caregivers.profile_id', 'profile.id')
        .leftJoin('external', 'caregivers.external_id', 'external.id')
        .leftJoin('franchisors', 'carelogs.franchisor_id', 'franchisors.id')
        .leftJoin('agencies', 'carelogs.agency_id', 'agencies.id')
        .where('carelogs.id', id)
        .first();

      return carelog || null;
    } catch (error) {
      console.error('Error in CarelogsRepository.findById:', error);
      throw new Error(`Failed to fetch carelog by ID: ${error.message}`);
    }
  }

  /**
   * Create a new carelog entry
   */
  async create(carelogData: Partial<Carelogs>): Promise<Carelogs> {
    try {
      // Validate required fields
      if (!carelogData.caregiver_id || !carelogData.start_datetime || !carelogData.end_datetime) {
        throw new Error('Missing required fields: caregiver_id, start_datetime, end_datetime');
      }

      // Validate foreign key references exist
      if (carelogData.caregiver_id) {
        const caregiverExists = await this.knex('caregivers')
          .where('id', carelogData.caregiver_id)
          .first();
        if (!caregiverExists) {
          throw new Error(`Caregiver with ID ${carelogData.caregiver_id} does not exist`);
        }
      }

      const now = new Date();
      const dataToInsert = {
        ...carelogData,
        status: carelogData.status || 'scheduled',
        created_at: now,
        updated_at: now
      };

      const [insertedId] = await this.knex('carelogs')
        .insert(dataToInsert)
        .returning('id');

      // Fetch and return the created carelog with related data
      const createdCarelog = await this.findById(insertedId);
      if (!createdCarelog) {
        throw new Error('Failed to retrieve created carelog');
      }

      return createdCarelog;
    } catch (error) {
      console.error('Error in CarelogsRepository.create:', error);
      throw new Error(`Failed to create carelog: ${error.message}`);
    }
  }

  /**
   * Update an existing carelog
   */
  async update(id: number, carelogData: Partial<Carelogs>): Promise<Carelogs> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid ID provided');
      }

      // Check if carelog exists
      const existingCarelog = await this.findById(id);
      if (!existingCarelog) {
        throw new Error('Carelog not found');
      }

      // Validate foreign key references if being updated
      if (carelogData.caregiver_id) {
        const caregiverExists = await this.knex('caregivers')
          .where('id', carelogData.caregiver_id)
          .first();
        if (!caregiverExists) {
          throw new Error(`Caregiver with ID ${carelogData.caregiver_id} does not exist`);
        }
      }

      const dataToUpdate = {
        ...carelogData,
        updated_at: new Date()
      };

      // Remove undefined values
      Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined) {
          delete dataToUpdate[key];
        }
      });

      await this.knex('carelogs')
        .where('id', id)
        .update(dataToUpdate);

      // Fetch and return the updated carelog with related data
      const updatedCarelog = await this.findById(id);
      if (!updatedCarelog) {
        throw new Error('Failed to retrieve updated carelog');
      }

      return updatedCarelog;
    } catch (error) {
      console.error('Error in CarelogsRepository.update:', error);
      throw new Error(`Failed to update carelog: ${error.message}`);
    }
  }

  /**
   * Delete a carelog (soft delete by updating status)
   */
  async delete(id: number): Promise<boolean> {
    try {
      if (!id || id <= 0) {
        throw new Error('Invalid ID provided');
      }

      // Check if carelog exists
      const existingCarelog = await this.findById(id);
      if (!existingCarelog) {
        throw new Error('Carelog not found');
      }

      // Soft delete by updating status to 'deleted'
      const updatedRows = await this.knex('carelogs')
        .where('id', id)
        .update({
          status: 'deleted',
          updated_at: new Date()
        });

      return updatedRows > 0;
    } catch (error) {
      console.error('Error in CarelogsRepository.delete:', error);
      throw new Error(`Failed to delete carelog: ${error.message}`);
    }
  }

  /**
   * Get count of carelogs with optional filters
   */
  async getCount(filters: {
    status?: string;
    caregiver_id?: number;
    franchisor_id?: number;
    agency_id?: number;
    date_from?: Date;
    date_to?: Date;
  } = {}): Promise<number> {
    try {
      let query = this.knex('carelogs').count('* as count');

      // Apply filters
      if (filters.status) {
        query = query.where('status', filters.status);
      }
      if (filters.caregiver_id) {
        query = query.where('caregiver_id', filters.caregiver_id);
      }
      if (filters.franchisor_id) {
        query = query.where('franchisor_id', filters.franchisor_id);
      }
      if (filters.agency_id) {
        query = query.where('agency_id', filters.agency_id);
      }
      if (filters.date_from) {
        query = query.where('start_datetime', '>=', filters.date_from);
      }
      if (filters.date_to) {
        query = query.where('start_datetime', '<=', filters.date_to);
      }

      const result = await query.first();
      return parseInt(result?.count as string) || 0;
    } catch (error) {
      console.error('Error in CarelogsRepository.getCount:', error);
      throw new Error(`Failed to get carelog count: ${error.message}`);
    }
  }


  /**
   * Rank top performing caregivers based on completed visits and performance metrics
   */
  async rankTopCaregivers(limit: number = 10): Promise<any[]> {
    try {
      // Validate limit parameter
      if (!limit || limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      return await this.knex('carelogs')
        .select(
          'caregivers.id',
          this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
          'profile.email',
          'profile.certification_level',
          this.knex.raw('COUNT(carelogs.id) AS total_visits'),
          // Time-based metrics
          this.knex.raw(`
            AVG(
              EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.clock_in_actual_datetime))/60
            )::numeric(10,2) AS avg_visit_minutes
          `),
          this.knex.raw(`
            SUM(
              EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.clock_in_actual_datetime))/60
            )::numeric(10,2) AS total_visit_minutes
          `),
          this.knex.raw(`
            AVG(
              EXTRACT(EPOCH FROM (carelogs.clock_in_actual_datetime - carelogs.start_datetime))/60
            )::numeric(10,2) AS avg_clock_in_deviation_minutes
          `),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.clock_in_actual_datetime <= carelogs.start_datetime + INTERVAL '5 minutes' 
              THEN 1 END) AS on_time_count
          `),
          this.knex.raw(`
            (COUNT(CASE 
              WHEN carelogs.clock_in_actual_datetime <= carelogs.start_datetime + INTERVAL '5 minutes' 
              THEN 1 END) * 100.0 / COUNT(carelogs.id)) AS on_time_percentage
          `),
          // Combined performance score (weighted ranking)
          this.knex.raw(`
            (COUNT(carelogs.id) * 0.4 + 
            SUM(EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.clock_in_actual_datetime))/3600) * 0.3 +
            COUNT(CASE WHEN carelogs.clock_in_actual_datetime <= carelogs.start_datetime + INTERVAL '5 minutes' THEN 1 END) * 0.3) 
            AS performance_score
          `)
        )
        .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .innerJoin('profile', 'caregivers.profile_id', 'profile.id')
        .where('carelogs.status', 'completed')
        .where('caregivers.status', 'active')
        .whereNotNull('carelogs.clock_in_actual_datetime')
        .whereNotNull('carelogs.clock_out_actual_datetime')
        .groupBy('caregivers.id', 'profile.first_name', 'profile.last_name', 'profile.email', 'profile.certification_level')
        .orderBy('performance_score', 'desc')
        .limit(limit);
    } catch (error) {
      console.error('Error in CarelogsRepository.rankTopCaregivers:', error);
      throw new Error(`Failed to rank top caregivers: ${error.message}`);
    }
  }

  /**
   * Rank caregivers with reliability issues (late arrivals, cancellations, early departures)
   */
  async rankLowReliabilityPerformers(limit: number = 10): Promise<any[]> {
    try {
      // Validate limit parameter
      if (!limit || limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      return await this.knex('carelogs')
        .select(
          'caregivers.id',
          this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
          'profile.email',
          'profile.phone_number',
          this.knex.raw('COUNT(carelogs.id) AS total_visits'),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' 
              THEN 1 END) AS late_arrivals
          `),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.status IN ('cancelled', 'no_show') 
              THEN 1 END) AS cancellations
          `),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.clock_out_actual_datetime < carelogs.end_datetime - INTERVAL '30 minutes' 
              THEN 1 END) AS early_departures
          `),
          this.knex.raw(`
            (COUNT(CASE WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' THEN 1 END) * 100.0 / COUNT(carelogs.id)) AS late_arrival_percentage
          `),
          this.knex.raw(`
            (COUNT(CASE WHEN carelogs.status IN ('cancelled', 'no_show') THEN 1 END) * 100.0 / COUNT(carelogs.id)) AS cancellation_percentage
          `),
          // Reliability score (lower is worse)
          this.knex.raw(`
            (COUNT(CASE WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' THEN 1 END) +
             COUNT(CASE WHEN carelogs.status IN ('cancelled', 'no_show') THEN 1 END) * 2 +
             COUNT(CASE WHEN carelogs.clock_out_actual_datetime < carelogs.end_datetime - INTERVAL '30 minutes' THEN 1 END)) AS reliability_issues_count
          `)
        )
        .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .innerJoin('profile', 'caregivers.profile_id', 'profile.id')
        .where('caregivers.status', 'active')
        .groupBy('caregivers.id', 'profile.first_name', 'profile.last_name', 'profile.email', 'profile.phone_number')
        .having(this.knex.raw('COUNT(carelogs.id) >= 5')) // Only include caregivers with at least 5 visits
        .orderBy('reliability_issues_count', 'desc')
        .orderBy('late_arrival_percentage', 'desc')
        .limit(limit);
    } catch (error) {
      console.error('Error in CarelogsRepository.rankLowReliabilityPerformers:', error);
      throw new Error(`Failed to rank low reliability performers: ${error.message}`);
    }
  }

  /**
   * List carelogs with detailed comments (longer than specified character count)
   */
  async listDetailedComments(minCharCount: number = 100, limit: number = 20): Promise<any[]> {
    try {
      // Validate parameters
      if (!minCharCount || minCharCount <= 0) {
        throw new Error('Minimum character count must be greater than 0');
      }
      if (!limit || limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      return await this.knex('carelogs')
        .select(
          'carelogs.id',
          'carelogs.documentation',
          'carelogs.start_datetime',
          'carelogs.end_datetime',
          'carelogs.status',
          this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
          'franchisors.name as franchisor_name',
          'agencies.name as agency_name'
        )
        .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .innerJoin('profile', 'caregivers.profile_id', 'profile.id')
        .leftJoin('franchisors', 'carelogs.franchisor_id', 'franchisors.id')
        .leftJoin('agencies', 'carelogs.agency_id', 'agencies.id')
        .whereNotNull('carelogs.documentation')
        .where('carelogs.documentation', '!=', '')
        .orderBy('carelogs.documentation', 'desc')
        .orderBy('carelogs.start_datetime', 'desc')
        .limit(limit);
    } catch (error) {
      console.error('Error in CarelogsRepository.listDetailedComments:', error);
      throw new Error(`Failed to list detailed comments: ${error.message}`);
    }
  }

  /**
   * Rank caregivers by overtime hours worked
   */
  async rankOvertimeCaregivers(limit: number = 10): Promise<any[]> {
    try {
      // Validate limit parameter
      if (!limit || limit <= 0 || limit > 100) {
        throw new Error('Limit must be between 1 and 100');
      }

      return await this.knex('carelogs')
        .select(
          'caregivers.id',
          this.knex.raw("CONCAT(profile.first_name, ' ', profile.last_name) AS caregiver_name"),
          'profile.email',
          'profile.phone_number',
          this.knex.raw('COUNT(carelogs.id) AS total_visits'),
          this.knex.raw(`
            SUM(CASE 
              WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime 
              THEN EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.end_datetime)) / 60 
              ELSE 0 END) AS total_overtime_minutes
          `),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime 
              THEN 1 END) AS overtime_visits
          `),
          this.knex.raw(`
            AVG(CASE 
              WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime 
              THEN EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.end_datetime)) / 60 
              ELSE 0 END) AS avg_overtime_minutes_per_visit
          `),
          this.knex.raw(`
            (COUNT(CASE WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime THEN 1 END) * 100.0 / COUNT(carelogs.id)) AS overtime_percentage
          `)
        )
        .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
        .innerJoin('profile', 'caregivers.profile_id', 'profile.id')
        .where('carelogs.status', 'completed')
        .where('caregivers.status', 'active')
        .whereNotNull('carelogs.clock_out_actual_datetime')
        .groupBy('caregivers.id', 'profile.first_name', 'profile.last_name', 'profile.email', 'profile.phone_number')
        .having(this.knex.raw('SUM(CASE WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime THEN EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.end_datetime)) / 60 ELSE 0 END) > 0'))
        .orderBy('total_overtime_minutes', 'desc')
        .orderBy('overtime_percentage', 'desc')
        .limit(limit);
    } catch (error) {
      console.error('Error in CarelogsRepository.rankOvertimeCaregivers:', error);
      throw new Error(`Failed to rank overtime caregivers: ${error.message}`);
    }
  }
  /**
   * Analyze franchise performance metrics
   */
  async analyzeFranchisePerformance(): Promise<any[]> {
    try {
      return await this.knex('franchisors')
        .select(
          'franchisors.id',
          'franchisors.name',
          this.knex.raw('COUNT(carelogs.id) AS total_visits'),
          this.knex.raw(`SUM(CASE WHEN carelogs.status = 'completed' THEN 1 ELSE 0 END) AS completed_visits`),
          this.knex.raw(`
            (SUM(CASE WHEN carelogs.status = 'completed' THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(carelogs.id), 0)) AS completion_percentage
          `),
          this.knex.raw(`
            SUM(CASE 
              WHEN carelogs.clock_out_actual_datetime > carelogs.end_datetime 
              THEN EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.end_datetime)) / 60 
              ELSE 0 END) AS total_overtime_minutes
          `),
          this.knex.raw(`
            COUNT(CASE 
              WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' 
              THEN 1 END) AS late_arrivals
          `),
          this.knex.raw(`
            (COUNT(CASE WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' THEN 1 END) * 100.0 / NULLIF(COUNT(carelogs.id), 0)) AS late_arrival_percentage
          `)
        )
        .leftJoin('carelogs', 'franchisors.id', 'carelogs.franchisor_id')
        .groupBy('franchisors.id', 'franchisors.name')
        .orderBy('completed_visits', 'desc');
    } catch (error) {
      console.error('Error in CarelogsRepository.analyzeFranchisePerformance:', error);
      throw new Error(`Failed to analyze franchise performance: ${error.message}`);
    }
  }
}

