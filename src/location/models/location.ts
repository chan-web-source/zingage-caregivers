export interface Location {
  id: number;
  agency_id?: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}