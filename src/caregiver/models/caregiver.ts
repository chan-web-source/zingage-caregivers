export interface Caregiver {
  id: number;
  franchisor_id?: number;
  agency_id?: number;
  profile_id?: number;
  external_id?: number;
  location_id?: number;
  subdomain?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  gender?: string;
  applicant?: boolean;
  birthday_date?: Date | string;
  onboarding_date?: Date | string;
  applicant_status?: string;
  status?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}