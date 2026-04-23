import axios from 'axios';

// Dev: Vite proxy handles /api -> localhost:5001
// Prod: VITE_API_URL = https://compensation-diagnostic-backend.onrender.com/api
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: API_BASE });

// Auth token 自动塞 Authorization 头
const TOKEN_KEY = 'mx_token';
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use(config => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// 401 → 清 token 跳登录页
api.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      setToken(null);
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// ---------- Auth API ----------
export const registerApi = (data: { email: string; password: string; display_name?: string; company_name?: string }) =>
  api.post('/auth/register', data);
export const loginApi = (data: { email: string; password: string }) =>
  api.post('/auth/login', data);
export const fetchMe = () => api.get('/auth/me');

export const createSession = () => api.post('/sessions/');

export const uploadFile = (sessionId: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/upload/${sessionId}`, formData);
};

// 用户确认/修正过 AI 字段映射后调这个，真正跑 pipeline
export const confirmFieldMapping = (
  sessionId: string,
  mappings: Array<{ user_column: string; system_field: string }>,
) => api.post(`/upload/${sessionId}/confirm-mapping`, { mappings });

// 标准模板下载 URL（让浏览器直接跳转下载，不走 axios）
export const templateDownloadUrl = () => `${API_BASE}/upload/template`;

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

export const getReportPdfUrl = (sessionId: string) => {
  const base = import.meta.env.VITE_API_URL || '/api';
  return `${base}/report/${sessionId}/export-pdf`;
};

// ===== JE (Job Evaluation) API =====
export interface JeJob {
  id: string;
  title: string;
  department: string | null;
  function: string;
  jd_text: string;
  factors: Record<string, string> | null;
  result: {
    kh_score?: number;
    ps_score?: number;
    acc_score?: number;
    total_score?: number;
    job_grade?: number;
    profile?: string | null;
    pk_reasoning?: string;
    convergence_stats?: any;
    match_score?: number | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export const jeListFunctions = () =>
  api.get<{ catalog: Record<string, string[]> }>('/je/functions');

export const jeListJobs = () =>
  api.get<{ jobs: JeJob[] }>('/je/jobs');

export const jeCreateJob = (data: { title: string; function: string; department?: string; jd_text: string }) =>
  api.post<{ job: JeJob }>('/je/jobs', data);

export const jeGetJob = (jobId: string) =>
  api.get<{ job: JeJob }>(`/je/jobs/${jobId}`);

export const jeUpdateJd = (jobId: string, jdText: string) =>
  api.patch<{ job: JeJob }>(`/je/jobs/${jobId}/jd`, { jd_text: jdText });

export const jeUpdateFactors = (jobId: string, factors: Record<string, string>) =>
  api.patch<{ job: JeJob }>(`/je/jobs/${jobId}/factors`, { factors });

export const jeDeleteJob = (jobId: string) =>
  api.delete<{ ok: boolean }>(`/je/jobs/${jobId}`);

// ===== Skill API =====
export const getSkillRegistry = (mode?: string) =>
  api.get('/skill/registry', { params: mode ? { mode } : undefined });

export const classifyIntent = (message: string, context?: any) =>
  api.post('/skill/classify-intent', { message, context });

export const invokeSkill = (skillKey: string, sessionId: string, params: any) =>
  api.post('/skill/invoke', { skill_key: skillKey, session_id: sessionId, params });

export default api;
