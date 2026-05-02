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
  // Hay 三个维度的 Level — 给前端在 KH/PS/ACC 分数旁展示 Lv X
  // 也用于 PS×KH 关系校验,可能为空(老数据)
  kh_level?: number | null;
  ps_level?: number | null;
  ps_percentage?: number | null;   // 0.87 / 0.76 / ... 用于 PS×KH 矩阵 row 索引
  acc_level?: number | null;
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
    // Hay 三个维度的 Level — 前端展示 + PS×KH 关系校验用
    kh_level?: number | null;
    ps_level?: number | null;
    ps_percentage?: number | null;
    acc_level?: number | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export const jeListFunctions = () =>
  api.get<{ catalog: Record<string, string[]> }>('/je/functions');

export const jeListJobs = () =>
  api.get<{ jobs: JeJob[] }>('/je/jobs');

export const jeCreateJob = (data: { title: string; function: string; department?: string; jd_text?: string }) =>
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

/**
 * 下载批量评估 Excel 模板。
 * 后端 (require_auth) 现场用 openpyxl 生成,带职能下拉 + 3 行示例。
 * 用 axios + blob 拿到内容,再通过临时 <a> 触发浏览器下载,这样能保证
 * Authorization 头被带上 (anchor 直链没法带 Bearer token)。
 */
export const jeDownloadBatchTemplate = async (): Promise<void> => {
  const res = await api.get('/je/batch-template', { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = '岗位批量评估模板.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放 blob URL 让浏览器回收内存
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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

/** Hay 5 维能力等级(Success Profile 里 competencies 子字段) */
export interface JeCompetencyRequirement {
  required_level: number;          // 1-5
  weight?: number;                  // 0-1,可选,跟 required_level 配合算综合分
}

/** Success Profile — 岗位画像,跟 KF SP 同结构,V1 自定义字段后续可被替换 */
export interface JeSuccessProfile {
  purpose?: string;                 // 一句话岗位使命
  accountabilities?: string[];      // 核心职责 3-5 条
  requirements?: {
    education?: string;
    experience?: string;
    professional_skills?: string[];
  };
  competencies?: {
    专业力?: JeCompetencyRequirement;
    管理力?: JeCompetencyRequirement;
    合作力?: JeCompetencyRequirement;
    思辨力?: JeCompetencyRequirement;
    创新力?: JeCompetencyRequirement;
  };
  kpis?: string[];
}

/** 单个职级变体 — 共享同一份 SP,仅 hay_grade + factors + scores 不同 */
export interface JeGradeVariant {
  hay_grade: number;
  factors: Record<string, string>;
  kh_score: number;
  ps_score: number;
  acc_score: number;
  total_score: number;
  profile: string | null;
  kh_level?: number | null;
  ps_level?: number | null;
  ps_percentage?: number | null;
  acc_level?: number | null;
  level_label?: string | null;
}

export interface JeLibraryEntry {
  id: string;
  name: string;
  department: string | null;
  function: string;
  /** Success Profile — 同一 role family 的所有 grade variant 共享一份 */
  success_profile?: JeSuccessProfile;
  /**
   * 该 role family 的所有职级变体。一份 SP 共享,只是 hay_grade 不同
   * (例:HR 经理有 G15/G16/G17 三个 variant,SP 内容完全相同)。
   * 长度 ≥ 1。单职级岗位也用这个数组(只放 1 个 variant)。
   */
  grade_variants: JeGradeVariant[];
  /** standard library 元数据 — 子职能名,用于搜索匹配 */
  sub_function?: string;
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

// ----- 路径 C 组织访谈 (LLM 驱动多轮) -----
export interface JeOnboardingExtractRequest {
  question_id: 'Opening' | 'JE_Q1' | 'JE_Q2' | 'JE_Q3' | 'JE_Q4';
  answer: string;
  previous_value?: string;
  is_follow_up?: boolean;
  round?: number;
  follow_up_question?: string;
  context?: string;
}
export interface JeOnboardingExtractResponse {
  extracted: Array<{ field_name: string; value: string }>;
  reply: string;
  follow_up: boolean;
}
export const jeOnboardingExtract = (body: JeOnboardingExtractRequest) =>
  api.post<JeOnboardingExtractResponse>('/je/onboarding/extract', body);

// library: null 时,后端返回 hint 字段说明为啥(一般是行业不命中标准库)
export const jeGenerateLibrary = (config?: { timeout?: number }) =>
  api.post<{ library: JeLibrary | null; hint?: string }>('/je/library/generate', undefined, {
    timeout: config?.timeout ?? 0,    // 默认 0=无 timeout (axios 默认行为不变)
  });

export const jeGetLibrary = () =>
  api.get<{ library: JeLibrary | null }>('/je/library');

// 从库 entry 创建 Job(不调 LLM,毫秒级)。target_grade 选定 entry.grade_variants
// 里的具体 variant;不传则用第一个 variant
export const jeCreateJobFromLibrary = (params: {
  lib_id: string;
  target_grade?: number;
  title?: string;
  department?: string;
}) =>
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

// ============================================================================
// SD V2 - 战略解码 (Strategy Decoding) — KF 5 层分解模型
// ============================================================================

/** V2 访谈产出 - 7 个 markdown 字段 */
export interface SdProfile {
  vision_targets_md: string;       // 战略愿景 + 量化目标
  business_model_md: string;       // 业务模式 + 价值主张
  differentiators_md: string;      // 关键差异化 + 竞争壁垒
  value_chain_md: string;          // 价值链关键环节 + 制约
  mwb_candidates_md: string;       // 必赢之仗候选
  constraints_md: string;          // 关键约束
  core_departments_md: string;     // 核心部门
}

/** BSC 战略地图节点 (4 层面) */
export interface SdBscNode {
  goal: string;
  measure: string;
  target_value?: string;
  rationale?: string;
}

export interface SdBscMap {
  financial: SdBscNode[];
  customer: SdBscNode[];
  internal_process: SdBscNode[];
  learning_growth: SdBscNode[];
  causal_summary: string;
}

/** 必赢之仗 MWB - 5 维度描述 + 主帅副帅 + 一级行动 */
export interface SdMwbAction {
  action: string;
  due_date: string;
  owner_role: string;
  supporters_roles?: string[];
  resources_needed?: string[];
  milestones?: string[];
  metrics?: string[];
}

export interface SdMwb {
  id: string;
  title: string;
  why: string[];
  is_what: string[];
  is_not_what: string[];
  success_picture: string[];
  key_metrics: string[];
  difficulties: string[];
  positive_factors: string[];
  negative_factors: string[];
  key_drivers: string[];
  commander_role: string;
  vice_commander_role?: string;
  level1_actions: SdMwbAction[];
}

/** 部门 OGSM */
export interface SdOgsmStrategy {
  strategy: string;
  priority: 'H' | 'M' | 'L' | string;
  measures: string[];
  related_mwb_id?: string;
}

export interface SdOgsmGoal {
  goal: string;
  strategies: SdOgsmStrategy[];
}

export interface SdDepartmentOgsm {
  department: string;
  objective: string;
  goals: SdOgsmGoal[];
}

/** 季度路线图 */
export interface SdRoadmapMilestone {
  text: string;
  responsible_dept?: string;
  related_mwb_id?: string;
}

export interface SdRoadmapQuarter {
  quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4' | string;
  milestones: SdRoadmapMilestone[];
}

/** 一致性检查 (V2 扩展到 6 大类别) */
export interface SdConsistencyCheck {
  category: string;
  status: string;
  note: string;
}

/** 高管 PPC 雏形 */
export interface SdExecPpcKpi {
  kpi: string;
  target: string;
  weight_pct: number;
}

export interface SdExecPpc {
  exec_role: string;
  is_commander_of?: string[];
  organizational_kpis: SdExecPpcKpi[];
  review_dimensions: string[];
  capability_development: string[];
}

/** V2 完整解码地图 */
export interface SdDecoding {
  strategic_statement: string;
  bsc_map: SdBscMap;
  mwbs: SdMwb[];
  department_ogsms: SdDepartmentOgsm[];
  roadmap: SdRoadmapQuarter[];
  consistency_checks: SdConsistencyCheck[];
  exec_ppcs: SdExecPpc[];
  generated_at?: string;
  model_used?: string;
}

export const sdGetProfile = () =>
  api.get<{ profile: SdProfile | null; decoding: SdDecoding | null; updated_at?: string }>('/sd/profile');

export const sdSaveProfile = (profile: Partial<SdProfile>) =>
  api.post<{ ok: boolean; profile: SdProfile; decoding: SdDecoding | null }>('/sd/profile', profile);

/** V2 新增 - 从 SC 钻石模型拉初始 profile */
export const sdProfileFromSc = () =>
  api.post<{ ok: boolean; profile: SdProfile; message: string }>('/sd/profile/from-sc');

export const sdGenerateDecoding = (config?: { timeout?: number }) =>
  api.post<{ ok: boolean; decoding: SdDecoding }>('/sd/decoding/generate', undefined, {
    timeout: config?.timeout ?? 0,
  });

export interface SdInterviewExtractRequest {
  question_id: 'Opening' | 'SD2_Q1' | 'SD2_Q2' | 'SD2_Q3' | 'SD2_Q4' | 'SD2_Q5' | 'SD2_Q6' | 'SD2_Q7';
  answer: string;
  previous_value?: string;
  is_follow_up?: boolean;
  round?: number;
  follow_up_question?: string;
  context?: string;
}

export interface SdInterviewExtractResponse {
  extracted: Array<{ field_name: string; value: string }>;
  reply: string;
  follow_up: boolean;
}

export const sdInterviewExtract = (body: SdInterviewExtractRequest) =>
  api.post<SdInterviewExtractResponse>('/sd/interview/extract', body);

// ============================================================================
// SC - 战略澄清 (Strategy Clarification)
// ============================================================================

export interface ScProfile {
  arenas_md: string;
  vehicles_md: string;
  differentiators_md: string;
  staging_md: string;
  economic_logic_md: string;
}

export interface ScQualityTest {
  criterion: string;
  status: string;
  note: string;
}

export interface ScDiamond {
  strategic_statement: string;
  diamond: {
    arenas: string;
    vehicles: string;
    differentiators: string;
    staging: string;
    economic_logic: string;
  };
  quality_tests: ScQualityTest[];
  consistency_warnings: string[];
  completeness_gaps: string[];
  generated_at?: string;
  model_used?: string;
}

export const scGetProfile = () =>
  api.get<{ profile: ScProfile | null; diamond: ScDiamond | null; updated_at?: string }>('/sc/profile');

export const scSaveProfile = (profile: Partial<ScProfile>) =>
  api.post<{ ok: boolean; profile: ScProfile; diamond: ScDiamond | null }>('/sc/profile', profile);

export const scGenerateDiamond = (config?: { timeout?: number }) =>
  api.post<{ ok: boolean; diamond: ScDiamond }>('/sc/diamond/generate', undefined, {
    timeout: config?.timeout ?? 0,
  });

export interface ScInterviewExtractRequest {
  question_id: 'Opening' | 'SC_Q1' | 'SC_Q2' | 'SC_Q3' | 'SC_Q4' | 'SC_Q5';
  answer: string;
  previous_value?: string;
  is_follow_up?: boolean;
  round?: number;
  follow_up_question?: string;
  context?: string;
}

export interface ScInterviewExtractResponse {
  extracted: Array<{ field_name: string; value: string }>;
  reply: string;
  follow_up: boolean;
}

export const scInterviewExtract = (body: ScInterviewExtractRequest) =>
  api.post<ScInterviewExtractResponse>('/sc/interview/extract', body);

// ============================================================================
// OD - 组织诊断 (Organization Diagnosis)
// ============================================================================

export interface OdProfile {
  // EES 背景采集 (2 题)
  company_basics_md?: string;      // 公司基础情况 (行业 / 规模 / 阶段 / 业务现状)
  survey_focus_md?: string;        // 这次调研最关心的议题 + 期待发现什么
  // —— 历史字段 (老 OD V1 5 层访谈, 已废弃, 仅兼容老数据 ——)
  strategy_md?: string;
  organization_md?: string;
  talent_md?: string;
  comp_perf_md?: string;
  culture_leadership_md?: string;
}

export interface OdLayerFinding {
  status: string;
  current_state: string;
  observations: string[];
  pain_points: string[];
}

export interface OdLayerFindings {
  strategy: OdLayerFinding;
  organization: OdLayerFinding;
  talent: OdLayerFinding;
  comp_perf: OdLayerFinding;
  culture_leadership: OdLayerFinding;
}

export interface OdKeyFinding {
  title: string;
  evidence: string;
  impact: string;
}

export interface OdBenchmarkItem {
  topic: string;
  industry_practice: string;
  client_status: string;
  gap_assessment: string;
}

export interface OdRecommendation {
  title: string;
  rationale: string;
  priority: 'P0' | 'P1' | 'P2' | string;
  expected_impact: string;
  suggested_action: string;
}

export interface OdRecommendations {
  strategic: OdRecommendation[];
  systematic: OdRecommendation[];
  operational: OdRecommendation[];
}

export interface OdNextTool {
  related_finding: string;
  recommended_tool: 'sc' | 'sd' | 'je' | 'salary_diagnostic' | 'lti' | string;
  why: string;
}

export interface OdDiagnosisDoubleESummary {
  response_count: number;
  overall: {
    engagement_score: number;
    enablement_score: number;
    quadrant_distribution: Record<string, OdDoubleEQuadrantBucket>;
  };
  top_3_dimensions: OdDoubleEDimension[];
  bottom_3_dimensions: OdDoubleEDimension[];
  breakdown: OdDoubleEAgg['breakdown'];
}

export interface OdEngagementFindings {
  engagement_observation: string;
  enablement_observation: string;
  quadrant_observation: string;
  department_observation: string;
}

export interface OdDiagnosis {
  executive_summary: string;
  /** EES 新字段 — Double E 4 大块解读 */
  engagement_findings?: OdEngagementFindings;
  /** 兼容老 OD V1 的占位字段, EES 报告里此字段为空对象 */
  layer_findings: OdLayerFindings;
  top_strengths: OdKeyFinding[];
  top_gaps: OdKeyFinding[];
  industry_benchmarks: OdBenchmarkItem[];
  recommendations: OdRecommendations;
  next_tools: OdNextTool[];
  /** 真实定量数据 — 来自 Double E 员工调研, 由后端 aggregate_responses 注入 */
  double_e_summary?: OdDiagnosisDoubleESummary | null;
  generated_at?: string;
  model_used?: string;
}

export const odGetProfile = () =>
  api.get<{ profile: OdProfile | null; diagnosis: OdDiagnosis | null; updated_at?: string }>('/od/profile');

export const odSaveProfile = (profile: Partial<OdProfile>) =>
  api.post<{ ok: boolean; profile: OdProfile; diagnosis: OdDiagnosis | null }>('/od/profile', profile);

export const odGenerateDiagnosis = (config?: { timeout?: number }) =>
  api.post<{ ok: boolean; diagnosis: OdDiagnosis }>('/od/diagnosis/generate', undefined, {
    timeout: config?.timeout ?? 0,
  });

// ---------- OD Double E Survey API ----------
export interface OdSurveyQuestion {
  code: string;
  dimension: string;
  seq: number;
  text: string;
  benchmark_cn_all_industry: number | null;
  benchmark_global_high_perf: number | null;
}

export interface OdSurveyScale {
  description: string;
  options: Array<{ value: number; label: string; tier: string }>;
  agree_values: number[];
  neutral_values: number[];
  disagree_values: number[];
}

export interface OdSurveyAttrDef {
  key: string;
  label: string;
  type: 'text' | 'choice';
  required: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface OdSurveyState {
  id: string;
  token: string;
  name: string | null;
  total_employees: number;
  threshold: number;
  status: 'open' | 'closed';
  response_count: number;
  is_significant: boolean;
  progress_pct: number;
  aggregated: OdDoubleEAgg | null;
  created_at?: string;
  updated_at?: string;
}

export interface OdDoubleEDimension {
  name: string;
  item_count: number;
  n: number;
  agree: number;
  neutral: number;
  disagree: number;
  benchmark_cn: number | null;
  benchmark_global: number | null;
  gap_cn: number | null;
  gap_global: number | null;
}

export interface OdDoubleEQuadrantBucket {
  count: number;
  percentage: number;
  label_cn: string;
}

export interface OdDoubleEBreakdownRow {
  value: string;
  count: number;
  engagement_score: number;
  enablement_score: number;
  quadrant_pct: Record<string, number>;
}

export interface OdDoubleEAgg {
  response_count: number;
  overall: {
    engagement_score: number;
    enablement_score: number;
    quadrant_distribution: Record<string, OdDoubleEQuadrantBucket>;
  };
  dimensions: OdDoubleEDimension[];
  questions: Array<{
    code: string; dimension: string; text: string;
    n: number; agree: number; neutral: number; disagree: number;
    benchmark_cn: number | null; benchmark_global: number | null;
    gap_cn: number | null; gap_global: number | null;
  }>;
  breakdown: {
    department?: OdDoubleEBreakdownRow[];
    is_manager?: OdDoubleEBreakdownRow[];
    tenure?: OdDoubleEBreakdownRow[];
    age?: OdDoubleEBreakdownRow[];
  };
}

export const odSurveyGet = () =>
  api.get<{ survey: OdSurveyState | null }>('/od/survey');

export const odSurveyStart = (body: { total_employees: number; name?: string }) =>
  api.post<{ survey: OdSurveyState }>('/od/survey/start', body);

export const odSurveyRefresh = () =>
  api.post<{ response_count: number; threshold: number; is_significant: boolean; aggregated: OdDoubleEAgg | null }>(
    '/od/survey/refresh', undefined, { timeout: 60000 },
  );

export const odSurveyClose = () =>
  api.post<{ status: string }>('/od/survey/close');

// 公开接口 (员工填答页用, 不需要登录) — 直接用 axios.create 避开拦截器
const publicApi = axios.create({ baseURL: API_BASE });

export const odSurveyPublicGet = (token: string) =>
  publicApi.get<{
    survey_name: string; status: string;
    questions: OdSurveyQuestion[];
    scale: OdSurveyScale;
    employee_attributes: OdSurveyAttrDef[];
  }>(`/od/survey/public/${encodeURIComponent(token)}`);

export const odSurveyPublicSubmit = (token: string, body: { answers: Record<string, number>; attributes: Record<string, string> }) =>
  publicApi.post<{ ok: boolean; message: string }>(`/od/survey/public/${encodeURIComponent(token)}`, body);

export interface OdInterviewExtractRequest {
  question_id: 'Opening' | 'BG_Q1' | 'BG_Q2' | 'OD_Q1' | 'OD_Q2' | 'OD_Q3' | 'OD_Q4' | 'OD_Q5';
  answer: string;
  previous_value?: string;
  is_follow_up?: boolean;
  round?: number;
  follow_up_question?: string;
  context?: string;
}

export interface OdInterviewExtractResponse {
  extracted: Array<{ field_name: string; value: string }>;
  reply: string;
  follow_up: boolean;
}

export const odInterviewExtract = (body: OdInterviewExtractRequest) =>
  api.post<OdInterviewExtractResponse>('/od/interview/extract', body);

// ============================================================================
// LTI - 长期激励 (Long Term Incentive)
// ============================================================================

export interface LtiProfile {
  company_basics_md: string;        // 公司基础情况
  ownership_md: string;             // 股权结构与股东意愿
  lti_purpose_md: string;           // LTI 目的
  financial_md: string;             // 财务现状
  talent_md: string;                // 激励对象与人才
}

export interface LtiToolRecommendation {
  tool: string;
  tool_cn: string;
  fit_score: number;
  reason: string;
  pros: string[];
  cons: string[];
  applicable_factors?: string[];
}

export interface LtiNotRecommended {
  tool_cn: string;
  reason: string;
}

export interface LtiHoldingModel {
  primary: string;
  rationale: string;
  structure_description?: string;
}

export interface LtiParticipation {
  total_persons_estimate: string;
  scope_description: string;
  qualification: string[];
}

export interface LtiLevelDistribution {
  level: string;
  percent: string;
  individual_share: string;
}

export interface LtiTotalAllocation {
  total_amount_pct: string;
  individual_formula: string;
  level_distribution: LtiLevelDistribution[];
}

export interface LtiGrantVesting {
  grant_frequency: string;
  lock_period: string;
  vesting_schedule: string;
  total_period: string;
}

export interface LtiPerformanceCompletion {
  completion_range: string;
  vesting_pct: string;
}

export interface LtiPerformanceLink {
  metrics: string[];
  weight_distribution: string;
  performance_completion_table: LtiPerformanceCompletion[];
}

export interface LtiSpecialCase {
  scenario: string;
  handling: string;
}

export interface LtiPlanDesign {
  holding_model: LtiHoldingModel;
  participation: LtiParticipation;
  total_allocation: LtiTotalAllocation;
  grant_vesting: LtiGrantVesting;
  performance_link: LtiPerformanceLink;
  special_cases: LtiSpecialCase[];
}

export interface LtiSimYear {
  year: string;
  vested_amount: string;
  explanation: string;
}

export interface LtiSimFactor {
  factor: string;
  value: string;
}

export interface LtiIndividualSim {
  role: string;
  scenario_input: LtiSimFactor[];
  year_by_year_value: LtiSimYear[];
  total_value_estimate: string;
}

export interface LtiRisk {
  category: string;
  risk: string;
  mitigation: string;
}

export interface LtiNextStep {
  area: string;
  action: string;
  priority: 'P0' | 'P1' | 'P2' | string;
  expected_timeline: string;
  responsible_role?: string;
}

export interface LtiPlan {
  company_summary: string;
  recommended_tools: {
    primary: LtiToolRecommendation;
    secondary: LtiToolRecommendation[];
    not_recommended: LtiNotRecommended[];
  };
  plan_design: LtiPlanDesign;
  individual_simulation: LtiIndividualSim[];
  risks: LtiRisk[];
  next_steps: LtiNextStep[];
  generated_at?: string;
  model_used?: string;
}

export const ltiGetProfile = () =>
  api.get<{ profile: LtiProfile | null; plan: LtiPlan | null; updated_at?: string }>('/lti/profile');

export const ltiSaveProfile = (profile: Partial<LtiProfile>) =>
  api.post<{ ok: boolean; profile: LtiProfile; plan: LtiPlan | null }>('/lti/profile', profile);

export const ltiGeneratePlan = (config?: { timeout?: number }) =>
  api.post<{ ok: boolean; plan: LtiPlan }>('/lti/plan/generate', undefined, {
    timeout: config?.timeout ?? 0,
  });

export interface LtiInterviewExtractRequest {
  question_id: 'Opening' | 'LTI_Q1' | 'LTI_Q2' | 'LTI_Q3' | 'LTI_Q4' | 'LTI_Q5';
  answer: string;
  previous_value?: string;
  is_follow_up?: boolean;
  round?: number;
  follow_up_question?: string;
  context?: string;
}

export interface LtiInterviewExtractResponse {
  extracted: Array<{ field_name: string; value: string }>;
  reply: string;
  follow_up: boolean;
}

export const ltiInterviewExtract = (body: LtiInterviewExtractRequest) =>
  api.post<LtiInterviewExtractResponse>('/lti/interview/extract', body);

export default api;
