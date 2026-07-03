import axios from "axios";
import { useUserStore } from "@/stores/userStore";

const apiClient = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// 请求拦截器 — 自动注入 token
apiClient.interceptors.request.use((config) => {
  const token = useUserStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器 — 401 自动登出
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useUserStore.getState().logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
