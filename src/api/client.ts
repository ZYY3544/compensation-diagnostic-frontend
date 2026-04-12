import axios from 'axios';

// Dev: Vite proxy handles /api -> localhost:5001
// Prod: VITE_API_URL = https://compensation-diagnostic-backend.onrender.com/api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

export const createSession = () => api.post('/sessions/');

export const uploadFile = (sessionId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/upload/${sessionId}`, formData);
};

export const runAnalysis = (sessionId: string) =>
  api.post(`/report/${sessionId}/analyze`);

export const getReport = (sessionId: string) =>
  api.get(`/report/${sessionId}`);

export default api;
