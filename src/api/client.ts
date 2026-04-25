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
export interface JeCandidate {
  factors: Record<string, string>;
  kh_score: number;
  ps_score: number;
  acc_score: number;
  total_score: number;
  job_grade: number;
  profile: string | null;
  match_score: number | null;
  dominant: 'KH' | 'PS' | 'ACC' | 'unknown';
  orientation: string;       // '偏专业 / 操作型' / '偏管理 / 战略型' / '平衡型' / ''
}

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
    candidates?: JeCandidate[];   // 多解候选（top-N，按 profile/grade 多样性挑出）
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

// ----- 批量评估 -----
export interface JeBatchItem {
  index: number;
  title: string;
  function: string;
  department: string | null;
  has_jd?: boolean;
  function_inferred?: boolean;
  status: 'pending' | 'running' | 'done' | 'failed';
  job_id: string | null;
  model_used: string | null;
  error: string | null;
}

export interface JeBatch {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  completed: number;
  failed: number;
  progress: number;
  items: JeBatchItem[];
  error: string | null;
  created_at: string | null;
  finished_at: string | null;
}

export const jeCreateBatch = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<{ batch_id: string; total: number; parse_errors: string[] }>('/je/batches', fd);
};

export const jeGetBatch = (batchId: string) =>
  api.get<{ batch: JeBatch }>(`/je/batches/${batchId}`);

export const jeListBatches = () =>
  api.get<{ batches: Array<Pick<JeBatch, 'id' | 'status' | 'total' | 'completed' | 'failed' | 'created_at' | 'finished_at'>> }>('/je/batches');

// ----- 异常检测 -----
export interface JeAnomaly {
  severity: 'high' | 'medium' | 'low';
  type: 'inversion' | 'inflation' | 'missing_tier';
  title: string;
  message: string;
  evidence: string[];     // 涉及岗位 id
  department: string;
}

export const jeListAnomalies = () =>
  api.get<{ anomalies: JeAnomaly[]; job_count: number }>('/je/anomalies');

// ----- 人岗匹配 -----
export interface JeMatchEmployee {
  job_title: string;
  department: string | null;
  company_grade: string | null;
  hay_grade: number | null;
  name: string;
  row_number?: number;
}

export interface JeMatchEntry {
  employee: JeMatchEmployee;
  job: {
    id: string;
    title: string;
    department: string | null;
    function: string;
    job_grade: number | null;
  };
  gap: number | null;        // hay_grade(员工) - hay_grade(岗位)
  match_strategy: 'dept+title' | 'title' | 'fuzzy' | '';
}

export interface JeMatchResult {
  matched: JeMatchEntry[];
  unmatched: JeMatchEmployee[];
  by_cell: Record<string, any[]>;
  summary: {
    total_employees: number;
    matched_count: number;
    unmatched_count: number;
    match_rate: number;
    over_leveled: number;
    under_leveled: number;
    aligned: number;
    jobs_with_grade: number;
  };
  session_id: string;
}

export const jeMatch = (sessionId?: string) =>
  api.get<JeMatchResult>('/je/match', {
    params: sessionId ? { session_id: sessionId } : undefined,
  });

// ----- 组织画像 + AI 岗位库 -----
export interface JeOrgProfile {
  industry: string | null;
  headcount: number | null;
  departments: string[];
  layers: string[];
  department_layers?: Record<string, string[]>;
  existing_grade_system: string | null;
}

export interface JeLibraryEntry {
  id: string;
  name: string;
  department: string | null;
  function: string;
  factors: Record<string, string>;
  hay_grade: number | null;
  total_score: number;
  kh_score: number;
  ps_score: number;
  acc_score: number;
  profile: string | null;
  responsibilities: string[];
  invalid_factors?: boolean;
}

export interface JeLibrary {
  entries: JeLibraryEntry[];
  generated_at: string;
  model_used: string;
}

export const jeGetProfile = () =>
  api.get<{ profile: JeOrgProfile | null; library: JeLibrary | null; created_at?: string; updated_at?: string }>('/je/profile');

export const jeSaveProfile = (profile: JeOrgProfile) =>
  api.put<{ profile: JeOrgProfile; library: JeLibrary | null }>('/je/profile', profile);

export const jeGenerateLibrary = () =>
  api.post<{ library: JeLibrary }>('/je/library/generate');

export const jeGetLibrary = () =>
  api.get<{ library: JeLibrary | null }>('/je/library');

// 从库 entry 创建 Job（不调 LLM，毫秒级）
export const jeCreateJobFromLibrary = (params: { lib_id: string; title?: string; department?: string }) =>
  api.post<{ job: JeJob }>('/je/jobs/from-library', params);

// ----- 拖拽职级调整 -----
export interface JeAdjustGradeResult {
  job: JeJob;
  achieved: boolean;            // 是否精确命中目标职级
  diff: number | null;          // 实际职级 - target_grade
  changed_factors: string[];    // 哪些因子被调整了
}

export const jeAdjustGrade = (jobId: string, target_grade: number, department?: string) =>
  api.patch<JeAdjustGradeResult>(`/je/jobs/${jobId}/grade`, { target_grade, department });

// ----- 现行体系对比 -----
export interface JeCompareMatched {
  title: string;
  current_grade: number | null;
  raw_grade: string | null;
  ai_grade: number | null;
  gap: number | null;
  status: 'aligned' | 'ai_higher' | 'ai_lower' | 'parse_failed';
  match_strategy: 'dept+title' | 'title' | 'fuzzy' | '';
  job_id: string;
  job_title: string;
  department: string | null;
  function: string;
}

export interface JeCompareResult {
  matched: JeCompareMatched[];
  unmatched_legacy: Array<{ title: string; current_grade: number | null; raw_grade: string | null; department: string | null }>;
  unmatched_ai: Array<{ job_id: string; title: string; department: string | null; ai_grade: number | null }>;
  summary: {
    total_legacy: number;
    total_ai: number;
    matched_count: number;
    unmatched_legacy_count: number;
    unmatched_ai_count: number;
    aligned: number;
    ai_higher: number;
    ai_lower: number;
    parse_failed: number;
  };
  parse_errors: string[];
}

export const jeCompare = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<JeCompareResult>('/je/compare', fd);
};

// ===== Skill API =====
export const getSkillRegistry = (mode?: string) =>
  api.get('/skill/registry', { params: mode ? { mode } : undefined });

export const classifyIntent = (message: string, context?: any) =>
  api.post('/skill/classify-intent', { message, context });

export const invokeSkill = (skillKey: string, sessionId: string, params: any) =>
  api.post('/skill/invoke', { skill_key: skillKey, session_id: sessionId, params });

export default api;
