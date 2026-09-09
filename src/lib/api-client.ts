import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "@/types/api";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("ergonx_access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const institutionId = localStorage.getItem("ergonx_institution_id");

    if (institutionId) {
      config.headers["X-Institution-ID"] = institutionId;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("ergonx_access_token");
      localStorage.removeItem("ergonx_refresh_token");
    }

    return Promise.reject(error);
  }
);

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await apiClient.get<ApiResponse<T>>(url, config);
  return response.data;
}

export async function apiPost<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await apiClient.post<ApiResponse<T>>(url, body, config);
  return response.data;
}

export async function apiPut<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await apiClient.put<ApiResponse<T>>(url, body, config);
  return response.data;
}

export async function apiPatch<T, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await apiClient.patch<ApiResponse<T>>(url, body, config);
  return response.data;
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<ApiResponse<T>> {
  const response = await apiClient.delete<ApiResponse<T>>(url, config);
  return response.data;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          message?: string;
          errors?: unknown;
        }
      | undefined;

    if (data?.message) {
      return data.message;
    }

    if (error.response?.status === 403) {
      return "You do not have permission to perform this action.";
    }

    if (error.response?.status === 404) {
      return "The requested record could not be found.";
    }

    if (error.response?.status === 409) {
      return "This action conflicts with the current record state.";
    }

    if (error.response?.status && error.response.status >= 500) {
      return "The server encountered an error. Please try again.";
    }

    if (error.message) {
      return error.message;
    }
  }

  return "Something went wrong. Please try again.";
}

export default apiClient;