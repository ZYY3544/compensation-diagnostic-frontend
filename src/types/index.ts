export interface Message {
  role: 'user' | 'bot';
  text: string;
  chips?: string[];
}

export interface ParseResult {
  employee_count: number;
  grade_count: number;
  department_count: number;
  grades: string[];
  departments: string[];
  fields_detected: { name: string; detected: boolean }[];
  all_columns_status?: { name: string; has_data: boolean; mapped_to: string | null }[];
  sheet_count?: number;
  sheet_names?: string[];
  sheet2_summary?: {
    years: number[];
    year_count: number;
    metrics: { name: string; has_data: boolean }[];
  };
  completeness_issues: {
    row_missing: { row: number; field: string; issue: string }[];
    column_missing: { field: string; impact: string }[];
  };
  cleansing_corrections: { id: number; description: string; type: string }[];
  grade_matching: GradeMatch[];
  function_matching: FuncMatch[];
  data_completeness_score: number;
  unlocked_modules: string[];
  locked_modules: { name: string; reason: string }[];
}

export interface GradeMatch {
  client_grade: string;
  standard_grade: string | null;
  confidence: string;
  confirmed: boolean;
}

export interface FuncMatch {
  title: string;
  matched: string | null;
  confidence: string;
  confirmed: boolean;
  alternatives?: string[];
}

export interface ReportData {
  health_score: number;
  key_findings: { severity: string; text: string }[];
  modules: Record<string, any>;
}

export type Stage = 1 | 2 | 3 | 4;
