import axios from "axios";
import { useUserStore } from "@/stores/userStore";

const apiClient = axios.create({
  baseURL: "/api",
});

// 请求拦截器 — 自动注入 token + 动态 Content-Type
apiClient.interceptors.request.use((config) => {
  const token = useUserStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // FormData 时让浏览器自动设置 multipart/form-data
  if (config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  } else {
    config.headers.set("Content-Type", "application/json");
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
