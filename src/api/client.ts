import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.response.use(
  r => r,
  err => {
    console.error('[nexus-api]', err.message);
    return Promise.reject(err);
  }
);
