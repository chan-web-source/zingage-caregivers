import { Knex } from 'knex';
import { Caregiver } from '../models/caregiver';
import * as fs from 'fs';
import csv from 'csv-parser';
import axios from 'axios';
import { Transform } from 'stream';

export class CaregiverRepository {
  constructor(private knex: Knex) { }

  // =============================================================================
  // ETL PIPELINE METHODS
  // =============================================================================

  /**
   * EXTRACT: Get data from various sources
   */
  async extractFromCSV(filePath: string): Promise<any[]> {
    const data: any[] = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          data.push(row);
        })
        .on('end', () => {
          console.log(`Extracted ${data.length} records from CSV: ${filePath}`);
          resolve(data);
        })
        .on('error', (error) => {
          console.error('Error extracting from CSV:', error);
          reject(error);
        });
    });
  }

  async extractFromAPI(apiUrl: string, headers?: Record<string, string>): Promise<any[]> {
    try {
      const response = await axios.get(apiUrl, { headers });
      const data = Array.isArray(response.data) ? response.data : response.data.data || [];
      console.log(`Extracted ${data.length} records from API: ${apiUrl}`);
      return data;
    } catch (error) {
      console.error('Error extracting from API:', error);
      throw new Error(`Failed to extract data from API: ${error.message}`);
    }
  }

  async extractFromDatabase(query: string, sourceKnex?: Knex): Promise<any[]> {
    try {
      const db = sourceKnex || this.knex;
      const data = await db.raw(query);
      const records = data.rows || data;
      console.log(`Extracted ${records.length} records from database`);
      return records;
    } catch (error) {
      console.error('Error extracting from database:', error);
      throw new Error(`Failed to extract data from database: ${error.message}`);
    }
  }

  /**
   * TRANSFORM: Clean, reformat, and validate data
   */
  transformCaregiverData(rawData: any[]): any[] {
    return rawData.map((record, index) => {
      try {
        const transformed = {
          // Profile data
          franchisor_id: this.parseInteger(record.franchisor_id),
          agency_id: this.parseInteger(record.agency_id),
          location_id: this.parseInteger(record.locations_id || record.location_id),
          subdomain: this.cleanString(record.subdomain),
          first_name: this.cleanString(record.first_name, true),
          last_name: this.cleanString(record.last_name, true),
          email: this.cleanEmail(record.email),
          phone_number: this.cleanPhoneNumber(record.phone_number),
          gender: this.normalizeGender(record.gender),
          birthday_date: this.parseDate(record.birthday_date),
          onboarding_date: this.parseDate(record.onboarding_date),
          certification_level: this.cleanString(record.certification_level),
          hourly_rate: this.parseDecimal(record.hourly_rate),
          
          // Status data
          applicant: this.parseBoolean(record.applicant),
          applicant_status: this.cleanString(record.applicant_status),
          sstatus: this.normalizeStatus(record.status || record.sstatus),
          
          // External data
          external_system_id: this.cleanString(record.external_id || record.external_system_id),
          system_name: this.cleanString(record.system_name) || 'legacy_csv',
          
          // Caregiver status
          status: this.normalizeCaregiverStatus(record.status),
          
          // Metadata
          source_row: index + 1,
          extracted_at: new Date()
        };

        // Validate required fields
        this.validateRequiredFields(transformed, index + 1);
        
        return transformed;
      } catch (error) {
        console.error(`Error transforming record ${index + 1}:`, error);
        throw new Error(`Transformation failed at record ${index + 1}: ${error.message}`);
      }
    });
  }

  /**
   * Data cleaning and validation helper methods
   */
  private cleanString(value: any, required: boolean = false): string | null {
    if (value === null || value === undefined || value === '') {
      if (required) {
        throw new Error('Required string field is empty');
      }
      return null;
    }
    return String(value).trim();
  }

  private cleanEmail(email: any): string | null {
    if (!email) return null;
    const cleaned = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleaned)) {
      console.warn(`Invalid email format: ${email}`);
      return null;
    }
    return cleaned;
  }

  private cleanPhoneNumber(phone: any): string | null {
    if (!phone) return null;
    // Remove all non-digit characters except + at the beginning
    const cleaned = String(phone).replace(/[^\d+]/g, '');
    return cleaned || null;
  }

  private parseInteger(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? null : parsed;
  }

  private parseDecimal(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = parseFloat(String(value));
    return isNaN(parsed) ? null : parsed;
  }

  private parseDate(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return Boolean(value);
  }

  private normalizeGender(gender: any): string | null {
    if (!gender) return null;
    const normalized = String(gender).toLowerCase().trim();
    const genderMap: Record<string, string> = {
      'm': 'male',
      'f': 'female',
      'male': 'male',
      'female': 'female',
      'other': 'other',
      'prefer_not_to_say': 'prefer_not_to_say'
    };
    return genderMap[normalized] || 'other';
  }

  private normalizeStatus(status: any): string {
    if (!status) return 'active';
    const normalized = String(status).toLowerCase().trim();
    const statusMap: Record<string, string> = {
      'active': 'active',
      'inactive': 'inactive',
      'pending': 'pending',
      'suspended': 'suspended',
      'terminated': 'terminated'
    };
    return statusMap[normalized] || 'active';
  }

  private normalizeCaregiverStatus(status: any): string {
    if (!status) return 'active';
    const normalized = String(status).toLowerCase().trim();
    const statusMap: Record<string, string> = {
      'active': 'active',
      'deactivated': 'deactivated',
      'inactive': 'deactivated'
    };
    return statusMap[normalized] || 'active';
  }

  private validateRequiredFields(record: any, rowNumber: number): void {
    const requiredFields = ['first_name', 'last_name'];
    const missingFields = requiredFields.filter(field => !record[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in row ${rowNumber}: ${missingFields.join(', ')}`);
    }
  }

  /**
   * LOAD: Insert transformed data with error handling and batch processing
   */
  async loadCaregiverData(transformedData: any[], batchSize: number = 50): Promise<{
    totalProcessed: number;
    successCount: number;
    errorCount: number;
    errors: any[];
  }> {
    if (!transformedData || transformedData.length === 0) {
      console.log('No data to load');
      return {
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        errors: []
      };
    }

    const errors: any[] = [];
    let successCount = 0;
    const startTime = Date.now();

    try {
      // Validate batch size
      if (batchSize <= 0 || batchSize > 1000) {
        throw new Error('Batch size must be between 1 and 1000');
      }

      console.log(`Starting data load: ${transformedData.length} records in batches of ${batchSize}`);

      await this.knex.transaction(async (trx) => {
        const totalBatches = Math.ceil(transformedData.length / batchSize);
        
        for (let i = 0; i < transformedData.length; i += batchSize) {
          const batch = transformedData.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;
          
          console.log(`Processing batch ${batchNumber}/${totalBatches} (records ${i + 1}-${Math.min(i + batchSize, transformedData.length)})`);

          // Process each record in the batch
          for (const record of batch) {
            try {
              // Add timeout protection for individual record processing
              const insertPromise = this.insertSingleCaregiver(record, trx);
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Insert operation timed out after 30 seconds')), 30000);
              });
              
              await Promise.race([insertPromise, timeoutPromise]);
              successCount++;
              
              // Log progress for large batches
              if (successCount % 100 === 0) {
                console.log(`Progress: ${successCount} records processed successfully`);
              }
            } catch (error) {
              const errorDetails = {
                record: {
                  source_row: record.source_row,
                  first_name: record.first_name,
                  last_name: record.last_name,
                  email: record.email,
                  external_system_id: record.external_system_id
                },
                error: error.message,
                row: record.source_row,
                timestamp: new Date().toISOString(),
                batch_number: batchNumber
              };
              
              errors.push(errorDetails);
              console.error(`Error inserting record ${record.source_row}:`, error.message);
              
              // If too many errors in a batch, consider stopping
              if (errors.length > transformedData.length * 0.5) {
                console.warn('Error rate exceeds 50%, considering stopping the process');
                throw new Error('Too many errors encountered, stopping ETL process');
              }
            }
          }
          
          // Small delay between batches to prevent overwhelming the database
          if (batchNumber < totalBatches) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      });

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      console.log(`\n=== ETL LOAD SUMMARY ===`);
      console.log(`- Total records processed: ${transformedData.length}`);
      console.log(`- Successfully loaded: ${successCount}`);
      console.log(`- Errors: ${errors.length}`);
      console.log(`- Success rate: ${((successCount / transformedData.length) * 100).toFixed(2)}%`);
      console.log(`- Processing time: ${duration.toFixed(2)} seconds`);
      console.log(`- Records per second: ${(transformedData.length / duration).toFixed(2)}`);

      if (errors.length > 0) {
        console.log('\n=== ERROR DETAILS ===');
        console.log(`First ${Math.min(5, errors.length)} errors:`);
        errors.slice(0, 5).forEach((err, index) => {
          console.log(`${index + 1}. Row ${err.row}: ${err.error}`);
        });
        
        if (errors.length > 5) {
          console.log(`... and ${errors.length - 5} more errors`);
        }
        
        // Group errors by type for better analysis
        const errorTypes = errors.reduce((acc, err) => {
          const errorType = err.error.split(':')[0];
          acc[errorType] = (acc[errorType] || 0) + 1;
          return acc;
        }, {});
        
        console.log('\nError types summary:');
        Object.entries(errorTypes).forEach(([type, count]) => {
          console.log(`- ${type}: ${count} occurrences`);
        });
      }

      return {
        totalProcessed: transformedData.length,
        successCount,
        errorCount: errors.length,
        errors
      };
    } catch (error) {
      console.error('Transaction failed:', error);
      throw new Error(`ETL load failed: ${error.message}`);
    }
  }

  private async insertSingleCaregiver(record: any, trx: Knex.Transaction): Promise<void> {
    try {
      // Validate required fields before insertion
      if (!record.first_name || !record.last_name) {
        throw new Error(`Missing required fields: first_name=${record.first_name}, last_name=${record.last_name}`);
      }

      // Validate foreign key references if provided
      if (record.franchisor_id) {
        const franchisoreExists = await trx('franchisors').where('id', record.franchisor_id).first();
        if (!franchisoreExists) {
          throw new Error(`Franchisor with ID ${record.franchisor_id} does not exist`);
        }
      }

      if (record.agency_id) {
        const agencyExists = await trx('agencies').where('id', record.agency_id).first();
        if (!agencyExists) {
          throw new Error(`Agency with ID ${record.agency_id} does not exist`);
        }
      }

      if (record.location_id) {
        const locationExists = await trx('locations').where('id', record.location_id).first();
        if (!locationExists) {
          throw new Error(`Location with ID ${record.location_id} does not exist`);
        }
      }

      // Check for duplicate email if provided
      if (record.email) {
        const existingProfile = await trx('profile').where('email', record.email).first();
        if (existingProfile) {
          throw new Error(`Email ${record.email} already exists in the system`);
        }
      }

      // Insert into profile table first
      const profileData = {
        franchisor_id: record.franchisor_id,
        agency_id: record.agency_id,
        location_id: record.location_id,
        subdomain: record.subdomain,
        first_name: record.first_name,
        last_name: record.last_name,
        email: record.email,
        phone_number: record.phone_number,
        gender: record.gender,
        birthday_date: record.birthday_date,
        onboarding_date: record.onboarding_date,
        certification_level: record.certification_level,
        hourly_rate: record.hourly_rate,
        applicant: record.applicant,
        applicant_status: record.applicant_status,
        sstatus: record.sstatus,
        created_at: new Date(),
        updated_at: new Date()
      };

      let profileId;
      try {
        const result = await trx('profile').insert(profileData).returning('id');
        profileId = result[0];
        if (!profileId) {
          throw new Error('Failed to get profile ID after insertion');
        }
      } catch (error) {
        throw new Error(`Failed to insert profile: ${error.message}`);
      }

      // Insert into external table if external_system_id exists
      let externalId = null;
      if (record.external_system_id && record.external_system_id.trim() !== '') {
        try {
          // Check for duplicate external_id
          const existingExternal = await trx('external')
            .where('external_id', record.external_system_id)
            .where('system_name', record.system_name || 'legacy_csv')
            .first();
          
          if (existingExternal) {
            console.warn(`External ID ${record.external_system_id} already exists, using existing record`);
            externalId = existingExternal.id;
          } else {
            const externalData = {
              external_id: record.external_system_id,
              system_name: record.system_name || 'legacy_csv',
              created_at: new Date(),
              updated_at: new Date()
            };

            const result = await trx('external').insert(externalData).returning('id');
            externalId = result[0];
          }
        } catch (error) {
          throw new Error(`Failed to insert external record: ${error.message}`);
        }
      }

      // Insert into caregivers table with references
      const caregiverData = {
        franchisor_id: record.franchisor_id,
        agency_id: record.agency_id,
        profile_id: profileId,
        external_id: externalId,
        applicant_status: record.applicant_status,
        status: record.status,
        created_at: new Date(),
        updated_at: new Date()
      };

      try {
        await trx('caregivers').insert(caregiverData);
      } catch (error) {
        throw new Error(`Failed to insert caregiver: ${error.message}`);
      }
    } catch (error) {
      // Re-throw with additional context
      throw new Error(`insertSingleCaregiver failed for record ${record.source_row || 'unknown'}: ${error.message}`);
    }
  }

  /**
   * Complete ETL Pipeline - Extract, Transform, Load
   */
  async runETLPipeline(source: {
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
  } = {}): Promise<{
    success: boolean;
    extractedCount: number;
    transformedCount: number;
    loadResult?: any;
    errors: any[];
    duration: number;
  }> {
    const { 
      batchSize = 50, 
      validateOnly = false, 
      continueOnError = true,
      maxRetries = 3
    } = options;
    
    const startTime = Date.now();
    const pipelineErrors: any[] = [];
    let extractedCount = 0;
    let transformedCount = 0;
    let loadResult: any = null;
    
    try {
      console.log('=== STARTING ETL PIPELINE ===');
      console.log(`Source: ${source.type}`);
      console.log(`Batch size: ${batchSize}`);
      console.log(`Validate only: ${validateOnly}`);
      console.log(`Continue on error: ${continueOnError}`);
      
      // EXTRACT PHASE
      console.log('\n1. EXTRACTING data...');
      let rawData: any[];
      let retryCount = 0;
      
      while (retryCount <= maxRetries) {
        try {
          switch (source.type) {
            case 'csv':
              if (!source.path) throw new Error('CSV path is required');
              if (!fs.existsSync(source.path)) {
                throw new Error(`CSV file not found: ${source.path}`);
              }
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
          retryCount++;
          const errorMsg = `Extract attempt ${retryCount} failed: ${error.message}`;
          console.error(errorMsg);
          pipelineErrors.push({
            phase: 'extract',
            attempt: retryCount,
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          if (retryCount > maxRetries) {
            throw new Error(`Extract failed after ${maxRetries} retries: ${error.message}`);
          }
          
          console.log(`Retrying in ${retryCount * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
        }
      }
      
      extractedCount = rawData!.length;
      
      if (extractedCount === 0) {
        console.log('No data extracted. Pipeline completed.');
        return {
          success: true,
          extractedCount: 0,
          transformedCount: 0,
          errors: pipelineErrors,
          duration: Date.now() - startTime
        };
      }
      
      console.log(`✓ Extracted ${extractedCount} records`);
      
      // TRANSFORM PHASE
      console.log('\n2. TRANSFORMING data...');
      let transformedData: any[];
      
      try {
        transformedData = this.transformCaregiverData(rawData!);
        transformedCount = transformedData.length;
        console.log(`✓ Transformed ${transformedCount} records`);
        
        if (transformedCount < extractedCount) {
          const skippedCount = extractedCount - transformedCount;
          console.warn(`⚠ ${skippedCount} records were skipped during transformation`);
        }
      } catch (error) {
        const errorMsg = `Transform phase failed: ${error.message}`;
        console.error(errorMsg);
        pipelineErrors.push({
          phase: 'transform',
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        if (!continueOnError) {
          throw new Error(errorMsg);
        }
        
        // Try to continue with partial data if possible
        console.log('Attempting to continue with partial transformation...');
        transformedData = [];
        transformedCount = 0;
      }
      
      if (validateOnly) {
        console.log('\n=== VALIDATION COMPLETED ===');
        console.log(`✓ ${transformedCount} records would be loaded`);
        console.log(`✓ Pipeline validation successful`);
        return {
          success: true,
          extractedCount,
          transformedCount,
          errors: pipelineErrors,
          duration: Date.now() - startTime
        };
      }
      
      // LOAD PHASE
      if (transformedCount > 0) {
        console.log('\n3. LOADING data...');
        try {
          loadResult = await this.loadCaregiverData(transformedData!, batchSize);
          console.log(`✓ Load phase completed`);
        } catch (error) {
          const errorMsg = `Load phase failed: ${error.message}`;
          console.error(errorMsg);
          pipelineErrors.push({
            phase: 'load',
            error: error.message,
            timestamp: new Date().toISOString()
          });
          
          if (!continueOnError) {
            throw new Error(errorMsg);
          }
        }
      } else {
        console.log('\n3. SKIPPING load phase - no data to load');
      }
      
      const duration = Date.now() - startTime;
      
      console.log('\n=== ETL PIPELINE COMPLETED ===');
      console.log(`✓ Total duration: ${(duration / 1000).toFixed(2)} seconds`);
      console.log(`✓ Pipeline errors: ${pipelineErrors.length}`);
      
      return {
        success: pipelineErrors.filter(e => e.phase === 'extract' || e.phase === 'transform').length === 0,
        extractedCount,
        transformedCount,
        loadResult,
        errors: pipelineErrors,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n=== ETL PIPELINE FAILED ===');
      console.error(`✗ Error: ${error.message}`);
      console.error(`✗ Duration: ${(duration / 1000).toFixed(2)} seconds`);
      
      pipelineErrors.push({
        phase: 'pipeline',
        error: error.message,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: false,
        extractedCount,
        transformedCount,
        loadResult,
        errors: pipelineErrors,
        duration
      };
    }
  }

  private getCaregiverSelectFields() {
    return [
      'caregivers.id',
      'caregivers.profile_id',
      'caregivers.external_id',
      'caregivers.franchisor_id',
      'caregivers.agency_id',
      'caregivers.applicant_status',
      'caregivers.status',
      'caregivers.created_at',
      'caregivers.updated_at',
      // Profile fields
      'profile.location_id',
      'profile.subdomain as subdomain',
      'profile.first_name as first_name',
      'profile.last_name as last_name',
      'profile.email as email',
      'profile.phone_number as phone_number',
      'profile.gender as gender',
      'profile.applicant',
      'profile.birthday_date',
      'profile.onboarding_date',
      'profile.sstatus',
      // External fields
      'external.external_id as external_system_id',
      'external.system_name',
      // Location name
      'locations.name as location_name'
    ];
  }

  async findAll(): Promise<Caregiver[]> {
    return this.knex('caregivers')
      .select(this.getCaregiverSelectFields())
      .leftJoin('profile', 'caregivers.profile_id', 'profile.id')
      .leftJoin('external', 'caregivers.external_id', 'external.id')
      .leftJoin('locations', 'profile.location_id', 'locations.id')
      .orderBy('profile.last_name', 'asc');
  }

  async findAllActive(): Promise<Caregiver[]> {
    return this.knex('caregivers')
      .select(this.getCaregiverSelectFields())
      .leftJoin('profile', 'caregivers.profile_id', 'profile.id')
      .leftJoin('external', 'caregivers.external_id', 'external.id')
      .leftJoin('locations', 'profile.location_id', 'locations.id')
      .where('caregivers.status', 'active')
      .orderBy('profile.last_name', 'asc');
  }

  async findById(id: number): Promise<Caregiver | null> {
    const result = await this.knex('caregivers')
      .select(this.getCaregiverSelectFields())
      .leftJoin('profile', 'caregivers.profile_id', 'profile.id')
      .leftJoin('external', 'caregivers.external_id', 'external.id')
      .leftJoin('locations', 'profile.location_id', 'locations.id')
      .where('caregivers.id', id)
      .first();

    return result || null;
  }

  async create(caregiverData: Partial<Caregiver>): Promise<Caregiver> {
    return await this.knex.transaction(async (trx) => {
      // Create profile record first
      const profileData = {
        franchisor_id: caregiverData.franchisor_id,
        agency_id: caregiverData.agency_id,
        location_id: caregiverData.location_id,
        subdomain: caregiverData.subdomain,
        first_name: caregiverData.first_name,
        last_name: caregiverData.last_name,
        email: caregiverData.email,
        phone_number: caregiverData.phone_number,
        gender: caregiverData.gender,
        applicant: caregiverData.applicant,
        birthday_date: caregiverData.birthday_date,
        onboarding_date: caregiverData.onboarding_date,
        applicant_status: caregiverData.applicant_status,
        sstatus: caregiverData.sstatus || 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const [profileId] = await trx('profile').insert(profileData).returning('id');

      // Create external record if external_system_id is provided
      let externalId = null;
      if (caregiverData.external_system_id) {
        const externalData = {
          external_id: caregiverData.external_system_id,
          system_name: caregiverData.system_name || 'legacy_csv',
          created_at: new Date(),
          updated_at: new Date()
        };

        const [extId] = await trx('external').insert(externalData).returning('id');
        externalId = extId;
      }

      // Create caregiver record
      const caregiverRecord = {
        franchisor_id: caregiverData.franchisor_id,
        agency_id: caregiverData.agency_id,
        profile_id: profileId,
        external_id: externalId,
        applicant_status: caregiverData.applicant_status,
        status: caregiverData.status || 'active',
        created_at: new Date(),
        updated_at: new Date()
      };

      const [id] = await trx('caregivers').insert(caregiverRecord).returning('id');

      return this.findById(id)!;
    });
  }

  async update(id: number, caregiverData: Partial<Caregiver>): Promise<Caregiver | null> {
    return await this.knex.transaction(async (trx) => {
      // Get current caregiver to find profile_id and external_id
      const currentCaregiver = await trx('caregivers').where('id', id).first();
      if (!currentCaregiver) return null;

      // Update profile if profile data is provided
      if (currentCaregiver.profile_id) {
        const profileUpdates: any = {};
        if (caregiverData.location_id !== undefined) profileUpdates.location_id = caregiverData.location_id;
        if (caregiverData.subdomain !== undefined) profileUpdates.subdomain = caregiverData.subdomain;
        if (caregiverData.first_name !== undefined) profileUpdates.first_name = caregiverData.first_name;
        if (caregiverData.last_name !== undefined) profileUpdates.last_name = caregiverData.last_name;
        if (caregiverData.email !== undefined) profileUpdates.email = caregiverData.email;
        if (caregiverData.phone_number !== undefined) profileUpdates.phone_number = caregiverData.phone_number;
        if (caregiverData.gender !== undefined) profileUpdates.gender = caregiverData.gender;
        if (caregiverData.applicant !== undefined) profileUpdates.applicant = caregiverData.applicant;
        if (caregiverData.birthday_date !== undefined) profileUpdates.birthday_date = caregiverData.birthday_date;
        if (caregiverData.onboarding_date !== undefined) profileUpdates.onboarding_date = caregiverData.onboarding_date;
        if (caregiverData.sstatus !== undefined) profileUpdates.sstatus = caregiverData.sstatus;

        if (Object.keys(profileUpdates).length > 0) {
          profileUpdates.updated_at = new Date();
          await trx('profile').where('id', currentCaregiver.profile_id).update(profileUpdates);
        }
      }

      // Update external if external data is provided
      if (currentCaregiver.external_id && caregiverData.external_system_id !== undefined) {
        await trx('external').where('id', currentCaregiver.external_id).update({
          external_id: caregiverData.external_system_id,
          system_name: caregiverData.system_name || 'legacy_csv',
          updated_at: new Date()
        });
      }

      // Update caregiver record
      const caregiverUpdates: any = {};
      if (caregiverData.franchisor_id !== undefined) caregiverUpdates.franchisor_id = caregiverData.franchisor_id;
      if (caregiverData.agency_id !== undefined) caregiverUpdates.agency_id = caregiverData.agency_id;
      if (caregiverData.applicant_status !== undefined) caregiverUpdates.applicant_status = caregiverData.applicant_status;
      if (caregiverData.status !== undefined) caregiverUpdates.status = caregiverData.status;

      if (Object.keys(caregiverUpdates).length > 0) {
        caregiverUpdates.updated_at = new Date();
        await trx('caregivers').where('id', id).update(caregiverUpdates);
      }

      return this.findById(id);
    });
  }

  async delete(id: number): Promise<boolean> {
    const deletedRows = await this.knex('caregivers')
      .where('id', id)
      .del();

    return deletedRows > 0;
  }

  /**
   * Legacy method - now uses the new ETL pipeline
   * @deprecated Use runETLPipeline instead for more flexibility
   */
  async insertData(): Promise<void> {
    const csvFilePath = 'caregiver_data_20250415_sanitized.csv';
    
    try {
      console.log('=== LEGACY INSERT DATA METHOD ===');
      console.log('⚠ This method is deprecated. Consider using runETLPipeline for better control.');
      
      const result = await this.runETLPipeline({
        type: 'csv',
        path: csvFilePath
      }, {
        batchSize: 50,
        continueOnError: true,
        maxRetries: 2
      });
      
      // Log summary for legacy compatibility
      console.log('\n=== LEGACY METHOD SUMMARY ===');
      console.log(`✓ Pipeline success: ${result.success}`);
      console.log(`✓ Records extracted: ${result.extractedCount}`);
      console.log(`✓ Records transformed: ${result.transformedCount}`);
      
      if (result.loadResult) {
        console.log(`✓ Records loaded: ${result.loadResult.successCount}`);
        console.log(`✓ Load errors: ${result.loadResult.errorCount}`);
      }
      
      console.log(`✓ Total duration: ${(result.duration / 1000).toFixed(2)} seconds`);
      
      // Throw error if pipeline failed critically
      if (!result.success && result.errors.some(e => e.phase === 'extract')) {
        throw new Error(`Critical ETL failure: ${result.errors.find(e => e.phase === 'extract')?.error}`);
      }
      
      // Warn about errors but don't fail for load errors (legacy behavior)
      if (result.errors.length > 0) {
        console.warn(`⚠ Pipeline completed with ${result.errors.length} errors`);
      }
      
    } catch (error) {
      console.error('\n=== LEGACY INSERT DATA FAILED ===');
      console.error(`✗ Error: ${error.message}`);
      
      // Enhanced error context for debugging
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

}
