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

export const getParseSummary = (sessionId: string, summary: string) =>
  api.post(`/pipeline/${sessionId}/parse-summary`, { summary });

export const runCleansing = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/cleansing`);

export const runGradeMatch = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/grade-match`);

export const runFuncMatch = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/func-match`);

export const runAnalysis = (sessionId: string) =>
  api.post(`/report/${sessionId}/analyze`);

export const getReport = (sessionId: string) =>
  api.get(`/report/${sessionId}`);

export default api;
