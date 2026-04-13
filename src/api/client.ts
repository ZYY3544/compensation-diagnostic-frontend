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

export const getCompletenessSummary = (sessionId: string, summary: string) =>
  api.post(`/pipeline/${sessionId}/completeness-summary`, { summary });

export const createSnapshot = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/snapshot`);

export const runCleansing = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/cleansing`);

export const runGradeMatch = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/grade-match`);

export const runFuncMatch = (sessionId: string) =>
  api.post(`/pipeline/${sessionId}/func-match`);

export const revertCleansing = (sessionId: string, mutationId: number) =>
  api.post(`/pipeline/${sessionId}/cleansing/revert`, { mutation_id: mutationId });

export const getExportUrl = (sessionId: string) => {
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/pipeline/${sessionId}/cleansing/export`;
};

export const runAnalysis = (sessionId: string) =>
  api.post(`/report/${sessionId}/analyze`);

export const getReport = (sessionId: string) =>
  api.get(`/report/${sessionId}`);

export const getDiagnosisSummary = (sessionId: string) =>
  api.post(`/report/${sessionId}/diagnosis-summary`);

export const getModuleInsight = (sessionId: string, module: string) =>
  api.post(`/report/${sessionId}/module-insight`, { module });

export const getDiagnosisAdvice = (sessionId: string) =>
  api.post(`/report/${sessionId}/diagnosis-advice`);

export default api;
