export type VisibilityStatus = 'visible' | 'not_visible' | 'unknown';
export type QuerySort =
  'opportunity_score' | 'estimated_search_volume' | 'competitive_difficulty' | 'discovered_at';
export type SortOrder = 'asc' | 'desc';

export interface QueryItem {
  query_uuid: string;
  profile_uuid: string;
  run_uuid: string;
  query_text: string;
  opportunity_score: number | null;
  domain_visible: boolean | null;
  visibility_position: number | null;
  discovered_at: string;
  estimated_search_volume?: number | null;
  competitive_difficulty?: number | null;
  visibility_status?: VisibilityStatus;
  cited_domains?: string[];
  data_source?: 'llm_estimate';
  last_checked_at?: string | null;
}

export interface QueryParams {
  min_score?: number;
  status?: VisibilityStatus;
  page?: number;
  per_page?: number;
  sort?: QuerySort;
  order?: SortOrder;
}
