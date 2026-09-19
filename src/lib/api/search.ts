import { apiGet } from "./client";
import type {
  UniversalSearchParams,
  UniversalSearchResponse,
} from "@/types/search";

/**
 * Searches only records visible to the active membership. Queries shorter
 * than two characters are intentionally not sent because the backend rejects
 * them with `search_query_invalid`.
 */
export async function universalSearch({
  query,
  types,
  module,
  limit = 12,
}: UniversalSearchParams): Promise<UniversalSearchResponse> {
  return apiGet<UniversalSearchResponse>(
    "/search/",
    { params: { q: query, types: types?.join(","), module, limit } },
  );
}
