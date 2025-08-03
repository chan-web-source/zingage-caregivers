import { Knex } from 'knex';

/**
 * Migration to create the core schema for the ZingAge care management system
 * This migration establishes all core tables with proper relationships and constraints
 */
export async function up(knex: Knex): Promise<void> {
  // Create franchisors table first (no dependencies)
  await knex.schema.createTable('franchisors', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('code', 50).notNullable().unique();
    table.string('contact_email', 255);
    table.string('contact_phone', 20);
    table.text('address');
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.timestamps(true, true);

    // Indexes
    table.index('status');
    table.index('code');
  });

  // Create agencies table (depends on franchisors)
  await knex.schema.createTable('agencies', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').notNullable().references('id').inTable('franchisors').onDelete('RESTRICT');
    table.string('name', 255).notNullable();
    table.string('code', 50).notNullable();
    table.string('contact_email', 255);
    table.string('contact_phone', 20);
    table.text('address');
    table.string('region', 100);
    table.enum('status', ['active', 'inactive', 'suspended']).defaultTo('active');
    table.timestamps(true, true);

    // Unique constraint
    table.unique(['franchisor_id', 'code']);

    // Indexes
    table.index('franchisor_id');
    table.index('status');
    table.index('region');
  });

  // Create locations table (depends on franchisors and agencies)
  await knex.schema.createTable('locations', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').references('id').inTable('franchisors').onDelete('RESTRICT');
    table.integer('agency_id').references('id').inTable('agencies').onDelete('RESTRICT');
    table.string('name', 255).notNullable();
    table.text('address').notNullable();
    table.string('city', 100);
    table.string('state', 50);
    table.string('zip_code', 20);
    table.string('country', 50).defaultTo('USA');
    table.decimal('latitude', 10, 8);
    table.decimal('longitude', 11, 8);
    table.enum('location_type', ['client_home', 'facility', 'office', 'community']).defaultTo('client_home');
    table.enum('status', ['active', 'inactive']).defaultTo('active');
    table.timestamps(true, true);

    // Indexes
    table.index('franchisor_id');
    table.index('agency_id');
    table.index('location_type');
    table.index(['latitude', 'longitude']);
  });

  // Create clients table (depends on franchisors, agencies, locations)
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').references('id').inTable('franchisors').onDelete('RESTRICT');
    table.integer('agency_id').references('id').inTable('agencies').onDelete('RESTRICT');
    table.integer('primary_location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.string('external_id', 100);
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('email', 255);
    table.string('phone_number', 20);
    table.date('date_of_birth');
    table.enum('gender', ['male', 'female', 'other', 'prefer_not_to_say']);
    table.string('emergency_contact_name', 255);
    table.string('emergency_contact_phone', 20);
    table.text('medical_conditions');
    table.text('care_plan');
    table.enum('status', ['active', 'inactive', 'discharged']).defaultTo('active');
    table.timestamps(true, true);

    // Indexes
    table.index('franchisor_id');
    table.index('agency_id');
    table.index('status');
    table.index(['last_name', 'first_name']);
    table.index('external_id');
  });

  // Create caregivers table (depends on franchisors, agencies, locations)
  await knex.schema.createTable('caregivers', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').references('id').inTable('franchisors').onDelete('RESTRICT');
    table.integer('agency_id').references('id').inTable('agencies').onDelete('RESTRICT');
    table.integer('profile_id').unique(); // Internal caregiver profile ID
    table.string('caregiver_id', 100).unique(); // Unique caregiver identifier (links CSVs)
    table.string('applicant_status', 100); // Hiring status (e.g., "New Applicant," "Not Hired")
    table.enum('status', ['active', 'deactivated']).defaultTo('active'); // Employment status

    // Legacy fields for backward compatibility
    table.integer('location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.string('subdomain', 100);
    table.string('first_name', 100).notNullable();
    table.string('last_name', 100).notNullable();
    table.string('email', 255).unique();
    table.string('phone_number', 20);
    table.enum('gender', ['male', 'female', 'other', 'prefer_not_to_say']);
    table.boolean('applicant').defaultTo(false);
    table.date('birthday_date');
    table.date('onboarding_date');
    table.string('applicant_status', 50);
    table.enum('sstatus', ['active', 'inactive', 'pending', 'suspended', 'terminated']).defaultTo('active');
    table.string('certification_level', 50);
    table.decimal('hourly_rate', 10, 2);
    table.timestamps(true, true);

    // Indexes
    table.index('franchisor_id');
    table.index('agency_id');
    table.index('location_id');
    table.index('status');
    table.index('sstatus');
    table.index('applicant');
    table.index('email');
    table.index('caregiver_id');
    table.index('profile_id');
    table.index('applicant_status');
    table.index(['last_name', 'first_name']);
  });

  // Create parent table for visit grouping and split shift management
  await knex.schema.createTable('parent', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').references('id').inTable('franchisors').onDelete('RESTRICT');
    table.integer('agency_id').references('id').inTable('agencies').onDelete('RESTRICT');
    table.integer('client_id').references('id').inTable('clients').onDelete('RESTRICT');
    table.integer('location_id').references('id').inTable('locations').onDelete('SET NULL');
    table.integer('primary_caregiver_id').references('id').inTable('caregivers').onDelete('SET NULL');

    // Scheduling information
    table.timestamp('scheduled_start_datetime').notNullable();
    table.timestamp('scheduled_end_datetime').notNullable();

    // Visit management
    table.string('visit_type', 50).defaultTo('regular'); // regular, emergency, makeup, etc.
    table.string('service_type', 100); // companionship, personal_care, medical, etc.
    table.string('priority_level', 20).defaultTo('normal'); // low, normal, high, urgent

    // Split management
    table.boolean('is_split').defaultTo(false);
    table.string('split_reason', 255); // caregiver_change, break_requirements, etc.
    table.integer('total_child_visits').defaultTo(0);

    // Status and notes
    table.string('status', 20).defaultTo('scheduled'); // scheduled, in_progress, completed, cancelled
    table.text('special_instructions');
    table.text('care_plan_notes');

    // Audit fields
    table.timestamps(true, true);

    // Indexes
    table.index('franchisor_id');
    table.index('agency_id');
    table.index('client_id');
    table.index('location_id');
    table.index('primary_caregiver_id');
    table.index('status');
    table.index('scheduled_start_datetime');
    table.index('scheduled_end_datetime');
    table.index('is_split');
  });

  // Create carelogs table (depends on caregivers, franchisors, agencies, parent)
  await knex.schema.createTable('carelogs', (table) => {
    table.increments('id').primary();
    table.integer('franchisor_id').references('id').inTable('franchisors').onDelete('RESTRICT');
    table.integer('agency_id').references('id').inTable('agencies').onDelete('RESTRICT');
    table.string('external_id', 50).unique(); // External carelog identifier from CSV
    table.integer('caregiver_id').notNullable().references('id').inTable('caregivers').onDelete('RESTRICT');
    table.integer('parent_id').references('id').inTable('parent').onDelete('SET NULL'); // References parent table

    // Scheduled times
    table.timestamp('start_datetime').notNullable();
    table.timestamp('end_datetime').notNullable();

    // Actual clock-in/out times
    table.timestamp('clock_in_actual_datetime');
    table.timestamp('clock_out_actual_datetime');

    // Clock-in/out methods (stored as VARCHAR to match CSV numeric codes)
    table.string('clock_in_method', 20);
    table.string('clock_out_method', 20);

    // Visit details
    table.string('status', 20).notNullable().defaultTo('scheduled'); // Numeric status code from CSV

    // Visit splitting
    table.boolean('split').defaultTo(false); // Boolean indicating if shift was split

    // Comments and documentation
    table.integer('general_comment_char_count').defaultTo(0); // Number of characters in caregiver comments

    // Audit fields
    table.timestamps(true, true);

    // Check constraints (Note: Knex doesn't support check constraints directly, these would need to be added via raw SQL)
    // We'll add these as comments for documentation

    // Indexes for performance
    table.index('caregiver_id');
    table.index('franchisor_id');
    table.index('agency_id');
    table.index('external_id');
    table.index('status');
    table.index('start_datetime');
    table.index('end_datetime');
    table.index(['start_datetime', 'end_datetime']);
    table.index('parent_id');
    table.index('created_at');

    // Composite indexes for common queries
    table.index(['caregiver_id', 'start_datetime']);
    table.index(['status', 'start_datetime']);
  });

  // Add check constraints via raw SQL (PostgreSQL specific)
  if (knex.client.config.client === 'postgresql' || knex.client.config.client === 'pg') {
    await knex.raw(`
      ALTER TABLE parent 
      ADD CONSTRAINT valid_scheduled_datetime_range 
      CHECK (scheduled_end_datetime > scheduled_start_datetime)
    `);

    await knex.raw(`
      ALTER TABLE carelogs 
      ADD CONSTRAINT valid_datetime_range 
      CHECK (end_datetime > start_datetime)
    `);

    await knex.raw(`
      ALTER TABLE carelogs 
      ADD CONSTRAINT valid_actual_times 
      CHECK (
        clock_out_actual_datetime IS NULL OR 
        clock_in_actual_datetime IS NULL OR 
        clock_out_actual_datetime > clock_in_actual_datetime
      )
    `);
  }

  // Create views for common queries
  await knex.raw(`
    CREATE VIEW active_caregivers AS
    SELECT 
      c.id,
      c.first_name || ' ' || c.last_name AS full_name,
      c.email,
      c.phone_number,
      c.certification_level,
      c.hourly_rate,
      f.name AS franchisor_name,
      a.name AS agency_name,
      l.name AS location_name
    FROM caregivers c
    LEFT JOIN franchisors f ON c.franchisor_id = f.id
    LEFT JOIN agencies a ON c.agency_id = a.id
    LEFT JOIN locations l ON c.location_id = l.id
    WHERE c.sstatus = 'active'
  `);

  await knex.raw(`
    CREATE VIEW completed_visits AS
    SELECT 
      cl.external_id,
      cl.caregiver_id,
      cl.parent_id,
      cl.start_datetime,
      cl.end_datetime,
      cl.clock_in_actual_datetime,
      cl.clock_out_actual_datetime,
      EXTRACT(EPOCH FROM (cl.end_datetime - cl.start_datetime))/3600 AS scheduled_hours,
      CASE 
        WHEN cl.clock_in_actual_datetime IS NOT NULL AND cl.clock_out_actual_datetime IS NOT NULL
        THEN EXTRACT(EPOCH FROM (cl.clock_out_actual_datetime - cl.clock_in_actual_datetime))/3600
        ELSE NULL
      END AS actual_hours,
      cg.first_name || ' ' || cg.last_name AS caregiver_name,
      cl.general_comment_char_count,
      p.visit_type,
      p.service_type,
      p.is_split
    FROM carelogs cl
    JOIN caregivers cg ON cl.caregiver_id = cg.id
    LEFT JOIN parent p ON cl.parent_id = p.id
    WHERE cl.status = 'completed'
  `);

  // Insert sample data for development
  await knex('franchisors').insert({
    name: 'ZingAge Care Network',
    code: 'ZACN',
    contact_email: 'admin@zingage.com',
    contact_phone: '1-800-ZINGAGE'
  });

  const [franchiseId] = await knex('agencies').insert({
    franchisor_id: 1,
    name: 'ZingAge Metro Care',
    code: 'ZMC',
    contact_email: 'metro@zingage.com',
    region: 'Metropolitan Area'
  }).returning('id');

  await knex('locations').insert({
    franchisor_id: 1,
    agency_id: franchiseId || 1,
    name: 'Downtown Care Center',
    address: '123 Main St',
    city: 'Anytown',
    state: 'ST',
    zip_code: '12345'
  });
}

/**
 * Rollback migration - drops all tables in reverse dependency order
 */
export async function down(knex: Knex): Promise<void> {
  // Drop views first
  await knex.raw('DROP VIEW IF EXISTS completed_visits');
  await knex.raw('DROP VIEW IF EXISTS active_caregivers');

  // Drop tables in reverse dependency order
  await knex.schema.dropTableIfExists('carelogs');
  await knex.schema.dropTableIfExists('parent');
  await knex.schema.dropTableIfExists('caregivers');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('locations');
  await knex.schema.dropTableIfExists('agencies');
  await knex.schema.dropTableIfExists('franchisors');
}