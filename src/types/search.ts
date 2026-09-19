/** Server-authorized result returned by `GET /api/v1/search/`. */
export interface SearchResult {
  type: string;
  module: string;
  id: string;
  reference: string;
  title: string;
  subtitle: string;
  status: string;
  updated_at: string;
  route_hint: string;
}

export interface UniversalSearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
}

export interface UniversalSearchParams {
  query: string;
  types?: string[];
  module?: string;
  limit?: number;
}
