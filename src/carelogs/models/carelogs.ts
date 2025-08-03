/**
 * Carelog model representing care visit records
 * This interface defines the structure for tracking caregiver visits based on CSV data format
 */
export interface Carelogs {
  /** Primary key - unique identifier for the carelog entry */
  id: number;

  /** Foreign key to franchisors table - identifies the franchisor organization */
  franchisor_id?: number;

  /** Foreign key to agencies table - identifies the agency managing the care */
  agency_id?: number;

  /** Foreign key to caregivers table - identifies the caregiver performing the visit */
  caregiver_id: number;

  /** Reference to the parent visit if this is a split visit (renamed from parent_visit_id) */
  parent_id?: number;

  /** Scheduled start date and time for the care visit */
  start_datetime: Date | string;

  /** Scheduled end date and time for the care visit */
  end_datetime: Date | string;

  /** Actual clock-in timestamp when caregiver arrived */
  clock_in_actual_datetime?: Date | string | null;

  /** Actual clock-out timestamp when caregiver left */
  clock_out_actual_datetime?: Date | string | null;

  /** Method used for clocking in (stored as string to match CSV numeric codes) */
  clock_in_method?: string;

  /** Method used for clocking out (stored as string to match CSV numeric codes) */
  clock_out_method?: string;

  /** Current status of the visit */
  status: string;

  /** Indicates if this visit was split from another visit (renamed from is_split) */
  split?: boolean;

  /** Additional documentation or notes about the visit */
  documentation?: string;

  /** External carelog identifier from CSV */
  external_id?: string;

  /** Number of characters in caregiver comments for the visit */
  general_comment_char_count?: number;

  /** Timestamp when the record was created */
  created_at?: Date | string;

  /** Timestamp when the record was last updated */
  updated_at?: Date | string;
}

/**
 * Enum for carelog status values
 */
export enum CarelogStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  DELETED = 'deleted'
}

/**
 * Enum for visit types
 */
export enum VisitType {
  REGULAR = 'regular',
  EMERGENCY = 'emergency',
  ASSESSMENT = 'assessment',
  TRAINING = 'training'
}

/**
 * Enum for clock-in/out methods
 */
export enum ClockMethod {
  MOBILE_APP = 'mobile_app',
  PHONE = 'phone',
  MANUAL = 'manual',
  GPS = 'gps'
}

/**
 * Interface for carelog creation (excludes auto-generated fields)
 */
export interface CreateCarelogData {
  caregiver_id: number;
  franchisor_id?: number;
  agency_id?: number;
  start_datetime: Date | string;
  end_datetime: Date | string;
  status?: CarelogStatus;
  documentation?: string;
}

/**
 * Interface for carelog updates (all fields optional except id)
 */
export interface UpdateCarelogData {
  caregiver_id?: number;
  franchisor_id?: number;
  agency_id?: number;
  start_datetime?: Date | string;
  end_datetime?: Date | string;
  clock_in_actual_datetime?: Date | string | null;
  clock_out_actual_datetime?: Date | string | null;
  clock_in_method?: ClockMethod;
  clock_out_method?: ClockMethod;
  status?: CarelogStatus;
  documentation?: string;
  split?: boolean;
  parent_id?: number;
}