import { Knex } from 'knex';
import { Caregiver } from '../models/caregiver';
import * as fs from 'fs';
import csv from 'csv-parser';
import * as path from 'path';
import { Carelogs } from '../../carelogs/models/carelogs';

export class CaregiverRepository {
  constructor(private knex: Knex) {
    this.knex = knex;
  }

  async insertData(): Promise<void> {
    const csvFilePath = path.join(__dirname, '../../data/caregivers.csv');
    const caregiversToInsert: Partial<Caregiver>[] = [];
    const BATCH_SIZE = 100;

    const parseBoolean = (value: any): boolean => {
      if (typeof value === 'string') {
        const lowerCaseValue = value.trim().toLowerCase();
        return lowerCaseValue === 'true' || lowerCaseValue === '1';
      }
      return !!value;
    };

    const parseDate = (value: string | null | undefined): Date | null => {
      if (!value || value.trim().toLowerCase() === 'none' || value.trim() === '') {
        return null;
      }
      const date = new Date(value);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date value encountered: ${value}`);
        return null;
      }
      return date;
    };

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Basic validation: ensure essential caregiver_id is present
          if (!row.caregiver_id) {
            console.warn('Skipping row due to missing caregiver_id:', row);
            return;
          }

          const caregiver: Partial<Caregiver> = {
            id: row.caregiver_id, // Using caregiver_id from CSV as the primary key
            subdomain: row.subdomain,
            first_name: row.first_name,
            last_name: row.last_name,
            email: row.email,
            phone_number: row.phone_number,
            gender: row.gender,
            applicant: parseBoolean(row.applicant),
            birthday_date: parseDate(row.birthday_date) || undefined,
            onboarding_date: parseDate(row.onboarding_date) || undefined,
            location_id: row.locations_id && row.locations_id !== '0' ? parseInt(row.locations_id) : null,
            applicant_status: row.applicant_status,
            status: row.status,
            // profile_id and external_id would require find-or-create logic
            // which adds complexity. For now, we assume they are provided if they exist.
            profile_id: row.profile_id || null,
            external_id: row.external_id || null,
            franchisor_id: row.franchisor_id ? parseInt(row.franchisor_id) : null,
            agency_id: row.agency_id ? parseInt(row.agency_id) : null,
          };

          // Clean out undefined/null properties to avoid inserting them
          Object.keys(caregiver).forEach(key => (caregiver[key] === undefined || caregiver[key] === null) && delete caregiver[key]);

          caregiversToInsert.push(caregiver);
        })
        .on('end', async () => {
          console.log(`Finished reading CSV. Total records to process: ${caregiversToInsert.length}`);

          if (caregiversToInsert.length === 0) {
            console.log("No caregivers to insert.");
            return resolve();
          }

          try {
            // Using transaction for atomicity of the whole batch operation.
            await this.knex.transaction(async (trx) => {
              // Process in batches to avoid memory issues and very large queries
              for (let i = 0; i < caregiversToInsert.length; i += BATCH_SIZE) {
                const batch = caregiversToInsert.slice(i, i + BATCH_SIZE);
                console.log(`Processing batch ${i / BATCH_SIZE + 1}...`);

                // Using onConflict().merge() to perform an "upsert".
                // It requires a unique constraint on the 'id' column.
                await trx('caregivers')
                  .insert(batch)
                  .onConflict('id')
                  .merge();
              }
            });

            console.log(`Successfully inserted/updated ${caregiversToInsert.length} caregivers.`);
            resolve();
          } catch (error) {
            console.error('Error during batch insert/update of caregivers:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading or parsing CSV file:', error);
          reject(error);
        });
    });
  }



  async findAllActive(): Promise<Caregiver[]> {
    return this.knex('caregivers')
      .select(
        'caregivers.id',
        'caregivers.subdomain',
        'caregivers.first_name',
        'caregivers.last_name',
        'caregivers.email',
        'caregivers.phone_number',
        'caregivers.gender',
        'caregivers.applicant',
        'caregivers.birthday_date',
        'caregivers.onboarding_date',
        'locations.location_name',
        'caregivers.location_id',
        'caregivers.applicant_status',
        'caregivers.status',
        'caregivers.created_at',
        'caregivers.updated_at'
      )
      .leftJoin('locations', 'caregivers.location_id', 'locations.id')
      .where('caregivers.status', 'active')
      .limit(10);
  }


  async findAll(): Promise<Caregiver[]> {
    return this.knex('caregivers')
      .select(
        'caregivers.id',
        'caregivers.subdomain',
        'caregivers.first_name',
        'caregivers.last_name',
        'caregivers.email',
        'caregivers.phone_number',
        'caregivers.gender',
        'caregivers.applicant',
        'caregivers.birthday_date',
        'caregivers.onboarding_date',
        'locations.location_name',
        'caregivers.location_id',
        'caregivers.applicant_status',
        'caregivers.status',
        'caregivers.created_at',
        'caregivers.updated_at'
      )
      .leftJoin('locations', 'caregivers.location_id', 'locations.id')
      .orderBy('caregivers.last_name', 'asc');
  }

  // Removed transactional performance methods to separate concerns
}
