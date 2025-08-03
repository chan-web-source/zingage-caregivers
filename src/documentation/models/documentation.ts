export interface Documentation {
  id: number;
  caregiver_id: number;
  type: string;
  content: string;
  uploaded_at?: Date | string;
  created_at?: Date | string;
  updated_at?: Date | string;
}