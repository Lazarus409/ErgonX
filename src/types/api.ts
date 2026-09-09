export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  errors: unknown;
}

export interface PaginatedData<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiListResponse<T> extends ApiResponse<PaginatedData<T>> {}

export interface ApiError {
  success: false;
  data: null;
  message: string;
  errors: unknown;
}