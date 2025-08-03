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
    return this.knex('franchisors')
      .select(
        'franchisors.id',
        'franchisors.name',
        this.knex.raw('COUNT(carelogs.id) AS total_visits'),
        this.knex.raw(`SUM(CASE WHEN carelogs.status = 'completed' THEN 1 ELSE 0 END) AS completed_visits`),
        this.knex.raw('AVG(carelogs.general_comment_char_count) AS avg_comment_length'),
        this.knex.raw(`
        SUM(
          EXTRACT(EPOCH FROM (carelogs.clock_out_actual_datetime - carelogs.clock_in_actual_datetime) -
          EXTRACT(EPOCH FROM (carelogs.end_datetime - carelogs.start_datetime))
        ) / 60 AS total_overtime_minutes
      `)
      )
      .leftJoin('carelogs', 'franchisors.id', 'carelogs.franchisor_id')
      .groupBy('franchisors.id', 'franchisors.name')
      .orderBy('completed_visits', 'desc');
  }
}

