•	Assumptions about ambiguous / missing data:
 clock_in_actual_datetime/clock_out_actual_datetime = NULL implies undocumented shifts.
 Multiple status fields (status, applicant_status) suggest multi-stage workflows.
 Missing birthday_date/onboarding_date = undisclosed, not invalid.

•	Rationale for schema choices & normal forms:
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

