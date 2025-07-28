import { Knex } from 'knex';
import { Carelogs } from '../models/carelogs';
import * as fs from 'fs';
import csv from 'csv-parser';
import * as path from 'path';
import { Caregiver } from '../../caregiver/models/caregiver';

export class CarelogsRepository {
  constructor(private knex: Knex) {
    this.knex = knex;
  }

  async insertData(): Promise<void> {
    const csvFilePath = path.join(__dirname, '../../data/caregiver_data_20250415_sanitized.csv');
    const caregivers: Caregiver[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          console.log('CSV Row:', row); // Debug: see what columns are in CSV
          const caregiver = {
            profile_id: row.profile_id || null,
            external_id: row.external_id || null,
            location_id: row.locations_id || null, // Map locations_id to location_id
            mcsubdomain: row.subdomain || '', // Map subdomain to mcsubdomain
            mcfirst_name: row.first_name || '', // Map first_name to mcfirst_name
            mclast_name: row.last_name || '', // Map last_name to mclast_name
            mcemail: row.email || '', // Map email to mcemail
            mcphone_number: row.phone_number || '', // Map phone_number to mcphone_number
            mcgender: row.gender || '', // Map gender to mcgender
            applicant: row.applicant === 'TRUE' || row.applicant === 'true' || row.applicant === '1',
            birthday_date: row.birthday_date && row.birthday_date.trim() !== '' ? new Date(row.birthday_date) : null,
            onboarding_date: row.onboarding_date && row.onboarding_date.trim() !== '' ? new Date(row.onboarding_date) : null,
            mcapplicant_status: row.applicant_status || '', // Map applicant_status to mcapplicant_status
            mcsstatus: row.status || '' // Map status to mcsstatus
          };
          caregivers.push(caregiver);
        })
        .on('end', async () => {
          try {
            console.log('Sample caregiver object:', caregivers[0]); // Debug: see mapped data
            console.log('Total records to insert:', caregivers.length);

            // Insert data in smaller batches to avoid parameter limits
            const batchSize = 50;
            for (let i = 0; i < caregivers.length; i += batchSize) {
              const batch = caregivers.slice(i, i + batchSize);
              await this.knex('caregivers').insert(batch);
              console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, records ${i + 1}-${Math.min(i + batchSize, caregivers.length)}`);
            }

            console.log(`Successfully inserted ${caregivers.length} caregivers`);
            resolve();
          } catch (error) {
            console.error('Detailed error:', error);
            reject(error);
          }
        })
        .on('error', (error) => {
          console.error('Error reading CSV file:', error);
          reject(error);
        });
    });
  }

  async findAllActive(): Promise<Carelogs[]> {
    return this.knex
      .select('*')
      .from('carelogs')
  }


}

