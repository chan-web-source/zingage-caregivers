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
    const csvFilePath = path.join(__dirname, '../../data/caregiver_data_20250415_sanitized.csv');
    const caregivers: Caregiver[] = [];

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          // Only collect first 45 records
          if (caregivers.length < 45) {
            console.log('CSV Row:', row); // Debug: see what columns are in CSV

            // Map only the most basic fields without foreign key constraints
            const caregiver: Caregiver = {};

            // Only use fields that don't have foreign key constraints
            if (row.subdomain) caregiver.subdomain = row.subdomain;
            if (row.first_name) caregiver.first_name = row.first_name;
            if (row.last_name) caregiver.last_name = row.last_name;
            if (row.applicant) caregiver.applicant = row.applicant === 'TRUE' || row.applicant === 'true' || row.applicant === '1';

            // Skip email and phone for now since field names are uncertain
            // if (row.email) caregiver.email = row.email;
            // if (row.phone_number) caregiver.phone_number = row.phone_number;

            // Handle date fields - only add if not empty
            if (row.birthday_date && row.birthday_date.trim() !== '' && row.birthday_date !== 'None') {
              caregiver.birthday_date = new Date(row.birthday_date);
            }
            if (row.onboarding_date && row.onboarding_date.trim() !== '' && row.onboarding_date !== 'None') {
              caregiver.onboarding_date = new Date(row.onboarding_date);
            }

            // Skip location_id to avoid foreign key constraint issues
            // if (row.locations_id && row.locations_id !== '0') {
            //   caregiver.location_id = parseInt(row.locations_id);
            // }

            caregivers.push(caregiver);
          }
        })
        .on('end', async () => {
          try {
            console.log('Sample caregiver object:', caregivers[0]); // Debug: see mapped data
            console.log('Total records to insert:', caregivers.length);

            // Insert records one by one without conflict handling
            for (let i = 0; i < caregivers.length; i++) {
              try {
                await this.knex('caregivers')
                  .insert(caregivers[i]);
                console.log(`Inserted record ${i + 1}/${caregivers.length}`);
              } catch (insertError) {
                console.error(`Error inserting record ${i + 1}:`, insertError);
                console.error('Failed record data:', caregivers[i]);
                // Continue with next record instead of failing completely
              }
            }

            console.log(`Completed processing ${caregivers.length} caregivers (first 45 records only)`);
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



  async findAllActive(): Promise<Caregiver[]> {

    return this.knex
      .select('*')
      .from('caregivers')
      .limit(10)
  }


  async findAll(): Promise<Caregiver[]> {
    return this.knex
      .select(
        'id',
        'subdomain',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'gender',
        'applicant',
        'birthday_date',
        'onboarding_date',
        'location_name',
        'locations_id',
        'applicant_status',
        'status',
        'created_at',
        'updated_at'
      )
      .from('caregivers')
      .orderBy('last_name', 'asc');
  }

  // high performance
  async rankTopCaregivers(): Promise<Caregiver[]> {
    return this.knex('carelogs')
      .select(
        'caregivers.id',
        this.knex.raw("CONCAT(caregivers.first_name, ' ', caregivers.last_name) AS name"),
        this.knex.raw('COUNT(carelogs.id) AS total_visits'),
        // Time-based metrics
        this.knex.raw(`
        AVG(
          EXTRACT(EPOCH FROM (clock_out_actual_datetime - clock_in_actual_datetime))/60
        )::numeric(10,2) AS avg_visit_minutes
      `),
        this.knex.raw(`
        SUM(
          EXTRACT(EPOCH FROM (clock_out_actual_datetime - clock_in_actual_datetime))/60
        )::numeric(10,2) AS total_visit_minutes
      `),
        this.knex.raw(`
        AVG(
          EXTRACT(EPOCH FROM (clock_in_actual_datetime - start_datetime))/60
        )::numeric(10,2) AS avg_clock_in_deviation_minutes
      `),
        this.knex.raw(`
        COUNT(CASE 
          WHEN clock_in_actual_datetime <= start_datetime + INTERVAL '5 minutes' 
          THEN 1 END) AS on_time_count
      `),
        // Combined score (weighted ranking)
        this.knex.raw(`
        (COUNT(carelogs.id) * 0.4 + 
        SUM(EXTRACT(EPOCH FROM (clock_out_actual_datetime - clock_in_actual_datetime))/3600) * 0.3 +
        COUNT(CASE WHEN clock_in_actual_datetime <= start_datetime + INTERVAL '5 minutes' THEN 1 END) * 0.3) 
        AS performance_score
      `)
      )
      .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
      .where('carelogs.status', 'completed')
      .whereNotNull('carelogs.clock_in_actual_datetime')
      .whereNotNull('carelogs.clock_out_actual_datetime')
      .groupBy('caregivers.id', 'caregivers.first_name', 'caregivers.last_name')
      .orderBy('performance_score', 'desc')
      .limit(10);
  }

  // low reliability - late
  async rankLowReliabilityPerformers(): Promise<Caregiver[]> {
    return this.knex('carelogs')
      .select(
        'caregivers.id',
        this.knex.raw("CONCAT(caregivers.first_name, ' ', caregivers.last_name) AS name"),
        this.knex.raw(`
        COUNT(CASE 
          WHEN carelogs.clock_in_actual_datetime > carelogs.start_datetime + INTERVAL '15 minutes' 
          THEN 1 END) AS late_arrivals,
        COUNT(CASE 
          WHEN carelogs.status IN ('cancelled', 'no-show') 
          THEN 1 END) AS cancellations,
        COUNT(CASE 
          WHEN carelogs.clock_out_actual_datetime < carelogs.end_datetime - INTERVAL '30 minutes' 
          THEN 1 END) AS early_departures
      `)
      )
      .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
      .groupBy('caregivers.id', 'caregivers.first_name', 'caregivers.last_name')
      .orderBy('late_arrivals', 'desc')
      .orderBy('cancellations', 'desc')
      .orderBy('early_departures', 'desc')
      .limit(10);
  }

  // detailed comments
  async listDetailedComments(): Promise<Carelogs[]> {
    return this.knex('carelogs')
      .select(
        'caregivers.id',
        this.knex.raw("CONCAT(caregivers.first_name, ' ', caregivers.last_name) AS name"),
        this.knex.raw('SUM(carelogs.general_comment_char_count) AS total_comment_chars'),
        this.knex.raw('AVG(carelogs.general_comment_char_count) AS avg_comment_length')
      )
      .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
      .where('carelogs.general_comment_char_count', '>', 0)
      .groupBy('caregivers.id', 'caregivers.first_name', 'caregivers.last_name')
      .orderBy('total_comment_chars', 'desc')
      .limit(10);
  }

  // caregivers working overtime
  async rankOvertimeCaregivers(): Promise<Caregiver[]> {
    return this.knex('carelogs')
      .select(
        'caregivers.id',
        this.knex.raw("CONCAT(caregivers.first_name, ' ', caregivers.last_name) AS name"),
        this.knex.raw(`
        SUM(
          EXTRACT(EPOCH FROM (clock_out_actual_datetime - clock_in_actual_datetime) -
          EXTRACT(EPOCH FROM (end_datetime - start_datetime))
        ) / 60 AS total_overtime_minutes
      `)
      )
      .innerJoin('caregivers', 'carelogs.caregiver_id', 'caregivers.id')
      .whereRaw('clock_out_actual_datetime > end_datetime')
      .groupBy('caregivers.id', 'caregivers.first_name', 'caregivers.last_name')
      .orderBy('total_overtime_minutes', 'desc')
      .limit(10);
  }
  async analyzeFranchisePerformance() {
    return this.knex('branchisors')
      .select(
        'branchisors.id',
        'branchisors.name',
        this.knex.raw('COUNT(carelogs.id) AS total_visits'),
        this.knex.raw('SUM(CASE WHEN carelogs.status = \'completed\' THEN 1 ELSE 0 END) AS completed_visits'),
        this.knex.raw('AVG(carelogs.general_comment_char_count) AS avg_comment_length'),
        this.knex.raw(`
        SUM(
          EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.clock_in_actual_datetime) -
          EXTRACT(EPOCH FROM (carelogs.end_datetime - carelogs.start_datetime))
        ) / 60 AS total_overtime_minutes
      `)
      )
      .leftJoin('carelogs', 'branchisors.id', 'carelogs.franchisor_id')
      .groupBy('branchisors.id', 'branchisors.name')
      .orderBy('completed_visits', 'desc');
  }
}
