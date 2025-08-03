# ZingAge Care Management System - Database Documentation

## Step 1 – ETL Pipeline Transformation Logic
1. I started by reviewing both CSV files—caregivers and carelogs—to understand the structure and relationship between them. It was clear that carelogs are work records tied to individual caregivers, making it a child table with caregiver_id as a foreign key. I then found the connections that carelog is the child table reliant on caregiver as the parent table. Carelog is the work summary (e.g. time, work, location) from the caregiver.
2. I identified all xxx_id fields as potential references to other tables. I then designed the database starting from parent tables like caregivers, franchisors, and agencies, and worked down to carelogs, ensuring top down schema relationships.
3. I then create a schema, set up tables according to the schema (from parent table to child table) in my local PostgreSQL.

## Step 2 – Schema Design & Normalization
1. The carelogs table has a column named caregiver_id, which is a foreign key referencing the id column in the caregivers table.
2. Both tables depend on multiple shared and share key structural tables with it (franchisors, agencies) with reusable data to avoid inserting same data for both tables.
3. As it’s scraped data inserting into tables, there should be edge case handling of missing data logic:
   a. Strict Insertion: missing fields will reject the insertion
   b. Partial insertion: insert data and handle nulls or add null to empty field to missing fields from scrapped data

## Step 3 – SQL Queries & Analytical Answers
1. Caregiver reliability and attendance
   - Top performers rank sample outputs:
     - Highest numbers of completed visits logic is calculated with:
       o Total times in carelogs
       o Reliant on clock_in_actual_datetime, clock_out_actual_datetime
2. Visit duration and operational efficiency
   - Status should be type according to number to define if is cancelled
     o Group status type of cancel, get the highest numbers of cancel and rank them in top 10 order
   - I saw that some timestamp is shorter some is longer (e.g. next day)
     o It should be reliant also on clock_in_method and clock_out_method
     o If clock_out_method is undefined, the actual work time need to add extra handling or make it not counted
     o Suggestion for enhancement: using linux timestamp over actual dateTime can avoid time range difference (e.g. now is using 2026/4/9 21:03:00 and change to linux timestamp of 1775954580)
3. Documentation and data
   - Take “general_comment_char_count” column to count their overall comments amount.
   - Filters caregivers who write available comments with in and group them according to total comments as percentage of their care logs
4. Caregiver overtime
   - Firstly, define Standard work limit (40 hours per week)
   - Write function to calculate Weekly Work Hours per Caregiver (select from carelogs, use clock_out_actual_datetime deduct clock_in_actual_datetime to get the hours) and sum them up
   - Potential correlation for overtime:
     - Agency type
     - Location (time of transportation)
     - Franchisor experience_level
     - clock_in_method
     These factors can be taken into account.

## Table Overview
- **caregivers**: Main table for caregiver records, linking to profile and external identifiers. See `CaregiverRepository.ts` for ETL and data logic.
- **carelogs**: Main table for care visit records, referencing caregivers and parent visits. See `CarelogsRepository.ts` for ETL and data logic.

## Schema Highlights
- **Parent-child relationships**: `carelogs` is a child table of `caregivers` via `caregiver_id` foreign key.
- **Referential integrity**: All foreign keys are validated during ETL; missing or invalid references cause clear, actionable errors.
- **Indexing**: Indexes are implemented on all foreign keys and frequently queried columns. See `schema.sql` for details.
- **Incremental loads**: ETL pipelines check for unique `external_id` and skip or update records as needed. No upserts by default; duplicates are rejected with clear errors.
- **Query performance**: Analytical queries are designed to use indexes and avoid unnecessary joins. Composite indexes and materialized views are recommended for large datasets.

## Indexing Strategy
- Indexes on: `carelogs.caregiver_id`, `carelogs.start_datetime`, `carelogs.status`, `caregivers.profile_id`, `profile.email`, and more.
- Composite indexes for common queries (e.g., `carelogs.caregiver_id, start_datetime`).
- See `schema.sql` for full index definitions and rationale.

## Query Performance Optimization
- Analytical queries use indexed columns and avoid unnecessary joins.
- Composite indexes and materialized views are recommended for high-frequency analytics.
- Query examples and performance tips are included in the repository.

## Sample Outputs
### Caregiver Table (after ETL)
| id | franchisor_id | agency_id | profile_id | external_id | applicant_status | status   | created_at           |
|----|---------------|-----------|------------|-------------|------------------|----------|----------------------|
| 1  | 1             | 1         | 1          | 1           | New Applicant    | active   | 2024-06-01T12:00:00Z |
| 2  | 1             | 1         | 2          | 2           | Not Hired        | inactive | 2024-06-01T12:01:00Z |

### Carelog Table (after ETL)
| id | franchisor_id | agency_id | external_id | caregiver_id | start_datetime       | end_datetime         | status     | split | general_comment_char_count |
|----|---------------|-----------|-------------|--------------|---------------------|----------------------|------------|-------|---------------------------|
| 1  | 1             | 1         | CLG-001     | 1            | 2024-06-01T08:00:00Z| 2024-06-01T12:00:00Z | completed  | false | 120                       |
| 2  | 1             | 1         | CLG-002     | 2            | 2024-06-01T13:00:00Z| 2024-06-01T17:00:00Z | scheduled  | false | 0                         |

For detailed schema, see `schema.sql`. For ETL logic, see `CaregiverRepository.ts` and `CarelogsRepository.ts`.


