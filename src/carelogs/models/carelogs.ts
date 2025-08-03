export interface Carelogs {
 id: number;
 franchisor_id?: number;
 agency_id?: number;
 carelog_id?: number;
 caregiver_id?: number;
 parent_id?: number;
 start_datetime?: Date | string;
 end_datetime?: Date | string;
 clock_in_actual_datetime?: Date | string | null;
 clock_out_actual_datetime?: Date | string | null;
 clock_in_method?: string;
 clock_out_method?: string;
 status?: string;
 split?: boolean;
 documentation?: string;
 general_comment_char_count?: number;
}