/**
 * Data Schema V2 Type Definitions
 * 
 * 새로운 Parquet 파일 스키마에 맞는 TypeScript 타입 정의
 */

/**
 * Chart data structure for 30D and 60D
 */
export interface ChartData {
  value: number[];
  spec_lower: number[];
  spec_upper: number[];
  act_date: string[];
}

/**
 * Main row data structure from backend
 */
export interface RowData {
  // Primary ID
  MASTER_TASK_ID: string;  // 최대 30자 (기존 variant_id)
  
  // Filter fields
  LINE: string;             // 라인 정보 (최대 50자, 검색 필터용)
  AREA: string;             // 영역 정보 (최대 50자, 검색 필터용)
  
  // Equipment & Parameter info
  PROD_EQP_ID: string;      // 설비호기 (최대 30자, 예: EQP100)
  PARAM_SUBITEM: string;    // 파라미터명+서브아이템 (최대 200자, 예: APC_ANGLE_AV)
  
  // Process info
  PPID: string;             // 프로세스 플랜 ID (최대 50자, 예: PPID_001)
  RECIPEID: string;         // 레시피 ID (최대 50자, 예: RECIPEID_001)
  CH_STEP: string;          // 챔버 스텝 (최대 50자, 예: CH_STEP_001)
  
  // Model result
  MODEL_RESULT_INFO: string; // 모델 결과 정보 (최대 200자, 기존 model_result)
  
  // Chart data (2 charts)
  "30D": ChartData;         // 30일 스캐터 차트 데이터
  "60D": ChartData;         // 60일 스캐터 차트 데이터
  
  // Comments & Notes
  COMMENTS: string;         // 인터락 풀 코멘트 (최대 300자)
  NOTES: string;            // 사용자 노트 (최대 300자)
  
  // Legacy support (기존 컬럼명도 임시 지원)
  variant_id?: string;      // MASTER_TASK_ID의 별칭
  model_result?: boolean | string;  // MODEL_RESULT_INFO의 별칭
  plot_data?: ChartData;    // 30D의 별칭
  tag?: string;             // 패턴 정보 (필터에서 사용)
  info_text?: string;       // 정보 텍스트 (필터에서 사용)
  notes?: string;           // NOTES의 별칭
}

/**
 * Note metadata from database
 */
export interface NoteMetadata {
  note: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

/**
 * Query response from backend
 */
export interface QueryResponse {
  rows: RowData[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  metrics?: {
    load_ms: number;
    filter_ms: number;
    aggregate_ms: number;
    paginate_ms: number;
    total_ms: number;
    rows_total: number;
    rows_page: number;
  };
  notes?: Record<string, NoteMetadata>;
}

