import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({ baseURL: API_BASE });

export const createSession = () => api.post('/sessions/');

export const getSession = (id: string) => api.get(`/sessions/${id}`);

export const getSessionStatus = (id: string) => api.get(`/sessions/${id}/status`);

export const uploadFile = (sessionId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/upload/${sessionId}`, formData);
};

export const confirmStep = (sessionId: string, step: string, value: any) =>
  api.post(`/sessions/${sessionId}/confirm`, { step, value });

export const sendMessage = (sessionId: string, message: string, stage: string) =>
  api.post(`/chat/${sessionId}/message`, { message, stage });

export const runAnalysis = (sessionId: string) =>
  api.post(`/report/${sessionId}/analyze`);

export const getReport = (sessionId: string) =>
  api.get(`/report/${sessionId}`);

export default api;
