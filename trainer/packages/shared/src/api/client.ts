import axios from 'axios';

// NOTE: WCA 公开 API，不需要认证
export const wcaApi = axios.create({
  baseURL: 'https://www.worldcubeassociation.org/api/v0',
  timeout: 10000,
});

// NOTE: CubeRoot Trainer 后端 API（开发环境通过 Vite proxy 转发）
export const trainerApi = axios.create({
  baseURL: '/trainer/api',
  timeout: 5000,
});

// NOTE: 自动注入 JWT token 到请求头
trainerApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
