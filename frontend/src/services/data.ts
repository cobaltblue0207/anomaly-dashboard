import axios from "axios";

const default_api_base = import.meta?.env?.VITE_API_BASE_URL ?? "http://115.136.116.13:8050";
const api = axios.create({ baseURL: default_api_base });

export interface Filters {
  line: string | string[];
  area: string;
  sensors?: string;  // V2: Optional, will be ignored by backend
  ai_result: string;
  patterns?: string;  // V2: Optional, will be ignored by backend
  period_from?: string;
  period_to?: string;
}
export interface QueryRequest { 
  filters: Filters; 
  page: number; 
  page_size: number;
  user_id?: string;
  pattern?: string;
}

export interface ChartData {
  act_date: string[];
  value: number[];
  spec_lower: number[];
  spec_upper: number[];
}

export interface ChartDataRequest {
  master_task_ids: string[];
  days?: number;
}

export const fetchOptions = async () => (await api.get('/filters/options')).data
export const queryData = async (body: QueryRequest) => (await api.post('/data/query', body)).data
export const loadNotes = async (user_id: string, pattern: string, ids: string[]) => (await api.post('/notes/load', { user_id, pattern, variant_ids: ids })).data
export const saveNote = async (user_id: string, pattern: string, variant_id: string, note: string, current_session_user: string) => (await api.post('/notes/save', { user_id, pattern, variant_id, note, current_session_user })).data

// Chart data APIs (V2)
export const loadChartDataSingle = async (master_task_id: string, days: number = 60): Promise<{ master_task_id: string; data: ChartData; days: number; count: number }> => 
  (await api.get(`/data/chart/${master_task_id}?days=${days}`)).data

export const loadChartDataBatch = async (body: ChartDataRequest): Promise<Record<string, ChartData>> => 
  (await api.post('/data/chart/batch', body)).data


