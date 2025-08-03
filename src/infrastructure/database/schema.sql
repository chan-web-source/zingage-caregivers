-- =============================================================================
-- ZINGAGE CARE MANAGEMENT SYSTEM - DATABASE SCHEMA
-- =============================================================================
-- This file defines the complete database schema for the care management system
-- including all tables, relationships, constraints, and indexes
-- =============================================================================

-- =============================================================================
-- CORE ENTITY TABLES (Parent tables first for foreign key dependencies)
-- =============================================================================

-- Franchisors table - Top-level organizations (No dependencies)
CREATE TABLE franchisors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agencies table - Regional care agencies under franchisors (Depends on franchisors)
CREATE TABLE agencies (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER NOT NULL REFERENCES franchisors(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    address TEXT,
    region VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(franchisor_id, code)
);

-- Locations table - Physical locations where care is provided (Depends on franchisors, agencies)
CREATE TABLE locations (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    location_type VARCHAR(50) DEFAULT 'client_home' CHECK (location_type IN ('client_home', 'facility', 'office', 'community')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table - People receiving care services (Depends on franchisors, agencies, locations)
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    primary_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    external_id VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone_number VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(20),
    medical_conditions TEXT,
    care_plan TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discharged')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile table - Caregiver profile information (Depends on franchisors, agencies, locations)
CREATE TABLE profile (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    
    -- Personal information
    subdomain VARCHAR(100),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    birthday_date DATE,
    
    -- Professional information
    certification_level VARCHAR(50),
    hourly_rate DECIMAL(10, 2),
    onboarding_date DATE,
    
    -- Status information
    applicant BOOLEAN DEFAULT false,
    applicant_status VARCHAR(50),
    sstatus VARCHAR(50) DEFAULT 'active' CHECK (sstatus IN ('active', 'inactive', 'pending', 'suspended', 'terminated')),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- External table - External system identifiers for caregivers (No dependencies)
CREATE TABLE external (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(100) UNIQUE NOT NULL, -- Unique caregiver identifier (links CSVs)
    system_name VARCHAR(50) DEFAULT 'legacy_csv', -- Source system name
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Caregivers table - Healthcare professionals providing care (Depends on franchisors, agencies, profile, external)
CREATE TABLE caregivers (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    profile_id INTEGER REFERENCES profile(id) ON DELETE SET NULL,
    external_id INTEGER REFERENCES external(id) ON DELETE SET NULL,
    applicant_status VARCHAR(100), -- Hiring status (e.g., "New Applicant," "Not Hired")
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'deactivated')), -- Employment status
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CARE VISIT TRACKING TABLES (Child tables after parent dependencies)
-- =============================================================================

-- Parent table - Groups related care visits and manages organizational hierarchy (Depends on franchisors, agencies, clients, locations, caregivers)
CREATE TABLE parent (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    client_id INTEGER REFERENCES clients(id) ON DELETE RESTRICT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    
    -- Core scheduling information
    scheduled_start_datetime TIMESTAMP NOT NULL,
    scheduled_end_datetime TIMESTAMP NOT NULL,
    primary_caregiver_id INTEGER REFERENCES caregivers(id) ON DELETE SET NULL,
    
    -- Visit management
    visit_type VARCHAR(50) DEFAULT 'regular' CHECK (visit_type IN ('regular', 'emergency', 'makeup', 'overtime')),
    service_type VARCHAR(100), -- Type of care service provided
    priority_level VARCHAR(20) DEFAULT 'normal' CHECK (priority_level IN ('low', 'normal', 'high', 'urgent')),
    
    -- Split and grouping management
    is_split BOOLEAN DEFAULT false,
    split_reason VARCHAR(255),
    total_child_visits INTEGER DEFAULT 1,
    
    -- Status and documentation
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'rescheduled')),
    care_instructions TEXT,
    notes TEXT,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_scheduled_datetime_range CHECK (scheduled_end_datetime > scheduled_start_datetime)
);

-- Carelogs table - Individual care visit records
CREATE TABLE carelogs (
    id SERIAL PRIMARY KEY,
    franchisor_id INTEGER REFERENCES franchisors(id) ON DELETE RESTRICT,
    agency_id INTEGER REFERENCES agencies(id) ON DELETE RESTRICT,
    external_id VARCHAR(50) UNIQUE, -- External carelog identifier from CSV
    caregiver_id INTEGER NOT NULL REFERENCES caregivers(id) ON DELETE RESTRICT,
    parent_id INTEGER REFERENCES parent(id) ON DELETE SET NULL, -- Reference to parent for grouping
    
    -- Scheduled times
    start_datetime TIMESTAMP NOT NULL,
    end_datetime TIMESTAMP NOT NULL,
    
    -- Actual clock-in/out times
    clock_in_actual_datetime TIMESTAMP,
    clock_out_actual_datetime TIMESTAMP,
    
    -- Clock-in/out methods (stored as VARCHAR to match CSV numeric codes)
    clock_in_method VARCHAR(20),
    clock_out_method VARCHAR(20),
    
    -- Visit details
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- Numeric status code from CSV
    
    -- Visit splitting
    split BOOLEAN DEFAULT false, -- Boolean indicating if shift was split
    
    -- Comments and documentation
    general_comment_char_count INTEGER DEFAULT 0, -- Number of characters in caregiver comments
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_datetime_range CHECK (end_datetime > start_datetime),
    CONSTRAINT valid_actual_times CHECK (
        clock_out_actual_datetime IS NULL OR 
        clock_in_actual_datetime IS NULL OR 
        clock_out_actual_datetime > clock_in_actual_datetime
    )
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Franchisors indexes
CREATE INDEX idx_franchisors_status ON franchisors(status);
CREATE INDEX idx_franchisors_code ON franchisors(code);

-- Agencies indexes
CREATE INDEX idx_agencies_franchisor_id ON agencies(franchisor_id);
CREATE INDEX idx_agencies_status ON agencies(status);
CREATE INDEX idx_agencies_region ON agencies(region);

-- Locations indexes
CREATE INDEX idx_locations_franchisor_id ON locations(franchisor_id);
CREATE INDEX idx_locations_agency_id ON locations(agency_id);
CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);

-- Clients indexes
CREATE INDEX idx_clients_franchisor_id ON clients(franchisor_id);
CREATE INDEX idx_clients_agency_id ON clients(agency_id);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_name ON clients(last_name, first_name);
CREATE INDEX idx_clients_external_id ON clients(external_id);

-- Profile indexes
CREATE INDEX idx_profile_franchisor_id ON profile(franchisor_id);
CREATE INDEX idx_profile_agency_id ON profile(agency_id);
CREATE INDEX idx_profile_location_id ON profile(location_id);
CREATE INDEX idx_profile_sstatus ON profile(sstatus);
CREATE INDEX idx_profile_applicant ON profile(applicant);
CREATE INDEX idx_profile_email ON profile(email);
CREATE INDEX idx_profile_name ON profile(last_name, first_name);
CREATE INDEX idx_profile_applicant_status ON profile(applicant_status);

-- External indexes
CREATE INDEX idx_external_external_id ON external(external_id);
CREATE INDEX idx_external_system_name ON external(system_name);

-- Caregivers indexes
CREATE INDEX idx_caregivers_franchisor_id ON caregivers(franchisor_id);
CREATE INDEX idx_caregivers_agency_id ON caregivers(agency_id);
CREATE INDEX idx_caregivers_profile_id ON caregivers(profile_id);
CREATE INDEX idx_caregivers_external_id ON caregivers(external_id);
CREATE INDEX idx_caregivers_status ON caregivers(status);
CREATE INDEX idx_caregivers_applicant_status ON caregivers(applicant_status);

-- Parent indexes
CREATE INDEX idx_parent_franchisor_id ON parent(franchisor_id);
CREATE INDEX idx_parent_agency_id ON parent(agency_id);
CREATE INDEX idx_parent_client_id ON parent(client_id);
CREATE INDEX idx_parent_location_id ON parent(location_id);
CREATE INDEX idx_parent_primary_caregiver_id ON parent(primary_caregiver_id);
CREATE INDEX idx_parent_status ON parent(status);
CREATE INDEX idx_parent_scheduled_start ON parent(scheduled_start_datetime);
CREATE INDEX idx_parent_scheduled_end ON parent(scheduled_end_datetime);
CREATE INDEX idx_parent_is_split ON parent(is_split);

-- Carelogs indexes (most important for performance)
CREATE INDEX idx_carelogs_caregiver_id ON carelogs(caregiver_id);
CREATE INDEX idx_carelogs_franchisor_id ON carelogs(franchisor_id);
CREATE INDEX idx_carelogs_agency_id ON carelogs(agency_id);
CREATE INDEX idx_carelogs_status ON carelogs(status);
CREATE INDEX idx_carelogs_start_datetime ON carelogs(start_datetime);
CREATE INDEX idx_carelogs_end_datetime ON carelogs(end_datetime);
CREATE INDEX idx_carelogs_date_range ON carelogs(start_datetime, end_datetime);
CREATE INDEX idx_carelogs_parent_id ON carelogs(parent_id);
CREATE INDEX idx_carelogs_external_id ON carelogs(external_id);
CREATE INDEX idx_carelogs_created_at ON carelogs(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_carelogs_caregiver_date ON carelogs(caregiver_id, start_datetime);
CREATE INDEX idx_carelogs_status_date ON carelogs(status, start_datetime);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables with updated_at columns
CREATE TRIGGER update_franchisors_updated_at BEFORE UPDATE ON franchisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profile_updated_at BEFORE UPDATE ON profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_external_updated_at BEFORE UPDATE ON external FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_caregivers_updated_at BEFORE UPDATE ON caregivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_parent_updated_at BEFORE UPDATE ON parent FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carelogs_updated_at BEFORE UPDATE ON carelogs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: general_comment_char_count is now populated from CSV data
-- No automatic trigger needed as this comes directly from the source system

-- =============================================================================
-- SAMPLE DATA INSERTS (for development/testing)
-- =============================================================================

-- Sample franchisor
INSERT INTO franchisors (name, code, contact_email, contact_phone) VALUES 
('ZingAge Care Network', 'ZACN', 'admin@zingage.com', '1-800-ZINGAGE');

-- Sample agency
INSERT INTO agencies (franchisor_id, name, code, contact_email, region) VALUES 
(1, 'ZingAge Metro Care', 'ZMC', 'metro@zingage.com', 'Metropolitan Area');

-- Sample location
INSERT INTO locations (franchisor_id, agency_id, name, address, city, state, zip_code) VALUES 
(1, 1, 'Downtown Care Center', '123 Main St', 'Anytown', 'ST', '12345');

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- View for active caregivers with their organization info
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
WHERE c.sstatus = 'active';

-- View for completed visits with duration calculations
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
WHERE cl.status = 'completed';

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE franchisors IS 'Top-level organizations that own multiple care agencies';
COMMENT ON TABLE agencies IS 'Regional care agencies that operate under franchisors';
COMMENT ON TABLE locations IS 'Physical locations where care services are provided';
COMMENT ON TABLE clients IS 'Individuals receiving care services';
COMMENT ON TABLE profile IS 'Caregiver profile information including personal details and status';
COMMENT ON TABLE external IS 'External system identifiers and references for caregivers';
COMMENT ON TABLE caregivers IS 'Core caregiver records linking profile and external data';
COMMENT ON TABLE parent IS 'Parent visit records for grouping related care visits and managing split shifts';
COMMENT ON TABLE carelogs IS 'Individual care visit records tracking scheduled and actual visit times';

COMMENT ON COLUMN carelogs.split IS 'Boolean indicating if shift was split into multiple shifts';
COMMENT ON COLUMN carelogs.parent_id IS 'References parent table for visit grouping and split shift management';
COMMENT ON COLUMN carelogs.external_id IS 'Unique visit log identifier from CSV';
COMMENT ON COLUMN carelogs.general_comment_char_count IS 'Number of characters caregiver provided as comments for the visit';
COMMENT ON COLUMN profile.sstatus IS 'Caregiver status in the system';
COMMENT ON COLUMN profile.applicant IS 'Boolean indicating if person is an applicant';
COMMENT ON COLUMN profile.applicant_status IS 'Hiring status (e.g., "New Applicant," "Not Hired")';
COMMENT ON COLUMN external.external_id IS 'External system identifier for the caregiver';
COMMENT ON COLUMN external.system_name IS 'Name of the external system providing the identifier';
COMMENT ON COLUMN caregivers.profile_id IS 'References profile table for caregiver personal information';
COMMENT ON COLUMN caregivers.external_id IS 'References external table for system identifiers';
COMMENT ON COLUMN caregivers.applicant_status IS 'Current hiring status of the caregiver';
COMMENT ON COLUMN parent.is_split IS 'Boolean indicating if this visit was split into multiple shifts';
COMMENT ON COLUMN parent.split_reason IS 'Reason for splitting the visit (e.g., caregiver change, break requirements)';
COMMENT ON COLUMN parent.total_child_visits IS 'Number of child visits created from this parent visit';
COMMENT ON COLUMN caregivers.status IS 'Employment status ("active," "deactivated")';