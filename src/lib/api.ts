import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      typeof window !== "undefined"
    ) {
      originalRequest._retry = true;

      const refreshToken =
        localStorage.getItem("refresh_token");

      if (refreshToken) {
        try {
          const baseURL =
            process.env.NEXT_PUBLIC_API_URL ||
            "http://localhost:8000/api/v1";

          const response = await axios.post(
            `${baseURL}/auth/token/refresh/`,
            {
              refresh: refreshToken,
            }
          );

          const newToken =
            response.data?.data?.access ||
            response.data?.access;

          if (newToken) {
            localStorage.setItem(
              "access_token",
              newToken
            );

            originalRequest.headers.Authorization =
              `Bearer ${newToken}`;

            return api(originalRequest);
          }
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");

          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
