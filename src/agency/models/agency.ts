export interface Agency {
  id: number;
  franchisor_id?: number;
  name: string;
  address?: string;
  created_at?: Date | string;
  updated_at?: Date | string;
}