•	Assumptions about ambiguous / missing data:
Ambigous data:
numbers of carelogs table clock_in and clock_out method representation of what method?
numbers of carelogs table status number represent of what status?

Missing:
numbers of carelogs table clock_in and clock_out method representation of what method?
numbers of carelogs table status number represent of what status?
Actual tables of agencies, franchisors, profiles, external_ids, parent, location

Insertion to database from scraped data:
As it’s scraped data inserting into tables, there should be Edge case handling of missing data logic: 
a.	Strict Insertion: missing fields will reject the insertion
b.	Partial insertion: insert data and handle nulls or add null to empty field to missing fields from scrapped data


•	Rationale for schema choices & normal forms:
My schema design steps: 
1.	I started by reviewing both CSV files—caregivers and carelogs—to understand the structure and relationship between them. It was clear that carelogs are work records tied to individual caregivers, making it a child table with caregiver_id as a foreign key.I then found the connections that carelog is the child table reliant on caregiver as the parent table. Carelog is the work summary (e.g. time, work, location) from the caregiver.
2.	I identified all xxx_id fields as potential references to other tables. I then designed the database starting from parent tables like caregivers, franchisors, and agencies, and worked down to carelogs, ensuring top down schema relationships.
3.	I then create a schema, set up tables according to the schema (from parent table to child table) in my local PostgreSQL 
Additional inputs:
 Foreign keys (profile_id, location_id) ensure referential integrity.
 Denormalized carelogs for faster time-based queries (tradeoff: slight redundancy).

•	Key trade offs or alternative designs you considered:
 1.	Denormalization:	To reduce the number of joins required for complex queries.
 2.	Sharding:	To distribute data across multiple servers for improved performance.
 3.	Indexing:	To speed up query performance.
  Option: Single status field → Chose separate fields for clearer workflow tracking.
  Option: Embed location_name in caregivers → Chose normalized locations table for scalability.
  Option: Split carelogs into scheduled/actual tables → Chose single table for simpler joins.

•	Link to your Loom demo:
part 1： https://www.loom.com/share/fd86e262f2f64686b39a4c65dec182e6?sid=2c01e3d8-5def-46e9-aea0-ea355529ff7e
part 2： https://www.loom.com/share/a29c8e4154e64f52a42f31fa9c45d8ff?sid=328ca709-f81f-452c-936f-682d29ed8a16

