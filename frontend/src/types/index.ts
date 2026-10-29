export interface SpecificationItem {
  name: string;
  value: string;
}

export interface ProductResult {
  id: number;
  job_id: string;
  row_index: number;
  mpn: string;
  manufacturer: string;
  title: string;
  product_name: string;
  status: 'SUCCESS' | 'REVIEW' | 'FAILED' | 'PENDING';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'REJECTED';
  tier: string;
  score: number;
  image_url: string;
  image_urls: string[];
  source_url: string;
  source_urls: string[];
  data_source_urls: string[];
  overview: string;
  features: string[];
  specifications: SpecificationItem[];
  fitments: string[];
  missing_fields: string[];
  validation_notes: string[];
  rework_reason: string;
  google_search_url: string;
  extraction_method: 'deterministic' | 'gemini_enhanced';
  created_at?: string;
  updated_at?: string;
}

export interface CurrentProductInfo {
  stage?: string;
  url?: string;
  mpn?: string;
  mfr?: string;
  index?: number;
  total?: number;
}

export interface Job {
  id: string;
  filename: string;
  original_filename: string;
  sheet_name: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  total_products: number;
  processed_products: number;
  successful_products: number;
  review_products: number;
  failed_products: number;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  current_product_info?: CurrentProductInfo;
  logs: string[];
  has_output: boolean;
}

export interface SheetInfo {
  name: string;
  row_count: number;
  column_count: number;
  detected_columns: {
    sno?: string | null;
    mpn1?: string | null;
    mpn?: string | null;
    mfr?: string | null;
    title?: string | null;
    upc?: string | null;
    url?: string | null;
    [key: string]: string | null | undefined;
  };
  headers: string[];
  preview_rows: (string | number)[][];
}

export interface UploadResponse {
  file_token: string;
  original_filename: string;
  sheets: SheetInfo[];
}

export interface JobStartRequest {
  file_token: string;
  sheet_name: string;
  column_mapping: Record<string, string>;
  limit?: number | null;
  start_row?: number | null;
  end_row?: number | null;
  sno_start?: number | null;
  sno_end?: number | null;
  timeout: number;
  retries: number;
  use_gemini: boolean;
  save_every: number;
  gemini_api_key?: string | null;
}

export interface ProductResultsPage {
  items: ProductResult[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface DashboardStats {
  total_products: number;
  completed_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  failed_jobs: number;
  successful_products: number;
  review_products: number;
  failed_products: number;
  recent_jobs: Job[];
}

export interface HealthStatus {
  status: string;
  gemini_available: boolean;
  search_available: boolean;
  database_connected: boolean;
  version: string;
}

