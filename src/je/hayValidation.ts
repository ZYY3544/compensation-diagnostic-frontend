/**
 * Hay 判错规则 — 从 Excel 试算表 (T2.Validation) 自动导出
 * 来源: JE 试算表_爱奇迹_20240627_初评-研讨会版本.xlsm
 * 生成脚本: /tmp/export_hay_validation.py
 *
 * 矩阵值含义: 0=合法 / 1=严重警告(黄) / 2=轻微提醒(青)
 * 调用 checkValidation(factors) 拿到所有触发的告警
 */

export const PK_SEQ = ["A-", "A", "A+", "B-", "B", "B+", "C-", "C", "C+", "D-", "D", "D+", "E-", "E", "E+", "F-", "F", "F+"];
export const MK_SEQ = ["T-", "T", "T+", "I-", "I", "I+", "II-", "II", "II+", "III-", "III", "III+", "IV-", "IV", "IV+"];
export const TE_SEQ = ["A-", "A", "A+", "B-", "B", "B+", "C-", "C", "C+", "D-", "D", "D+", "E-", "E", "E+", "F-", "F", "F+"];
export const TC_SEQ = ["1-", "1", "1+", "2-", "2", "2+", "3-", "3", "3+", "4-", "4", "4+", "5-", "5", "5+"];
export const FTA_SEQ = ["A-", "A", "A+", "B-", "B", "B+", "C-", "C", "C+", "D-", "D", "D+", "E-", "E", "E+", "F-", "F", "F+"];
export const NOI_SEQ = ["I-", "I", "I+", "II-", "II", "II+", "III-", "III", "III+", "IV-", "IV", "IV+", "V-", "V", "V+", "VI-", "VI", "VI+"];

// PS 矩阵的"调整符号"列轴 — 公式 MATCH(symbol, [N, +]) 给列偏移
export const PS_SYMBOL_ORDER = ["N", "+"];

// ============================================================
// 4 个判错矩阵
// 0/null=合法, 1=严重警告(黄), 2=轻微提醒(青)
// ============================================================

// KH 矩阵 (PK / MK / Comm 组合) — N43:AH66
// 公式: row = 1+3*(ceil(PK_pos/3)-1), col = 1+3*(ceil(MK_pos/3)-1)+(Comm-1)
export const KH_MATRIX = [
  [null, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, 1, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 2, null, null, null, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 2, 2, null, null, null, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 2, 2, null, null, null, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 2, 2, null, null, null, 2, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 2, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 2, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 2, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, 1, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, 1, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, 1, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, null, 2, 2, null, 2, 2, null],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, null, 2, 2, null, 2, 2, null],
  [2, 2, 2, null, null, null, 1, null, null, 2, 1, null, 2, 2, null, 2, 2, null, 2, 2, null],
  [2, 2, 2, null, null, 1, 1, null, null, 2, 1, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, 1, 1, null, null, 2, 1, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, null, null, 1, 1, null, null, 2, 1, null, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];

// PS 矩阵 (TE / TC / 调整符号) — N73:W80
// 公式: row = ceil(TE_pos/3), col = 1+2*(ceil(TC_pos/3)-1)+symbol_offset
export const PS_MATRIX = [
  [null, null, 1, 2, 2, 2, 2, 2, 2, 2],
  [1, null, null, null, 2, 2, 2, 2, 2, 2],
  [2, 2, null, null, null, null, 2, 2, 2, 2],
  [2, 2, 2, 1, null, null, null, 1, 2, 2],
  [2, 2, 2, 2, null, null, null, null, 1, 2],
  [2, 2, 2, 2, 2, 1, null, null, 1, 2],
  [2, 2, 2, 2, 2, 2, null, null, null, 2],
  [2, 2, 2, 2, 2, 2, 1, 1, null, null],
];

// PS × KH 关系矩阵 — O86:AS101
// 公式: row = MATCH(PS_Level, PS_LEVELS), col = MATCH(KH_Level, KH_LEVELS)
export const PSXKH_MATRIX = [
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, null, null, null, null],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, null, null, null, null, null, null, null, null],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, null, null, 1, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, null, null, null, 1, 1, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 2, 1, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 2, 1, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2, 1, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 1, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 2, 2, 1, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [2, 1, null, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, null, null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  [null, null, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
];
export const PSXKH_KH_LEVELS = [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46];   // 列轴
export const PSXKH_PS_LEVELS = [0.87, 0.76, 0.66, 0.57, 0.5, 0.43, 0.38, 0.33, 0.29, 0.25, 0.22, 0.19, 0.16, 0.14, 0.12, 0.1];   // 行轴

// ACC 矩阵 (FTA / NoI, 仅 Mag=N 时校验) — N108:S134
// 公式: row = 1+3*(ceil(FTA_pos/3)-1), col = ceil(NoI_pos/3)
export const ACC_MATRIX = [
  [null, null, 1, 2, 2, 2],
  [null, null, 1, 2, 2, 2],
  [null, null, 1, 2, 2, 2],
  [1, null, null, 1, 2, 2],
  [1, null, null, 1, 2, 2],
  [1, null, null, 1, 2, 2],
  [2, 1, null, null, 1, 2],
  [2, 1, null, null, 1, 2],
  [2, 1, null, null, 1, 2],
  [2, 2, 1, null, null, 1],
  [2, 2, 1, null, null, 1],
  [2, 2, 1, null, null, 1],
  [2, 2, 2, 1, null, null],
  [2, 2, 2, 1, null, null],
  [2, 2, 2, 1, null, null],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
  [2, 2, 2, 2, 2, 2],
];


// ============================================================================
// 校验函数 — 复刻 Excel T2.Validation 表的 INDEX/MATCH 公式
// ============================================================================

export type ValidationLevel = 'warn' | 'attention' | 'error';

export interface ValidationIssue {
  /** 触发的规则类型 */
  rule: 'kh' | 'ps' | 'ps_kh' | 'acc' | 'te_above_pk' | 'fta_above_pk' | 'fta_above_te' | 'profile_gap';
  /** 严重程度: warn(黄) / attention(青) / error(红) */
  level: ValidationLevel;
  /** 涉及的因子 (前端用来标红/黄色下拉框) */
  factors: string[];
  /** 给用户看的提醒文案 */
  message: string;
}

/** 把 1/2 矩阵值映射成 (level, factors) */
function levelFromMatrixValue(v: number | null): ValidationLevel | null {
  if (v === 1) return 'warn';
  if (v === 2) return 'attention';
  return null;
}

/** Excel 的 ROUNDUP(x/3, 0) — 1-3 → 1, 4-6 → 2, 7-9 → 3 */
function pkBaseGroup(pos: number): number {
  return Math.ceil(pos / 3);
}

/** Excel 公式里的 PK 行索引: 1+3*(group-1) */
function pkRowOffset(pos: number): number {
  return 1 + 3 * (pkBaseGroup(pos) - 1);
}

/**
 * 整套 Hay 校验。返回所有触发的告警。
 *
 * @param factors 8 因子档位 (跟 Job.factors 同结构)
 * @param khLevel 当前 KH Level (从 evaluate_with_factors 算出来)
 * @param psLevel 当前 PS Level
 * @param khScore 当前 KH 分数 (用来给 PS×KH 校验找 KH Level)
 *                — 如果调用方没有这些值，传 0/null 该校验自动跳过
 */
export function checkValidation(
  factors: Record<string, string>,
  khLevel: number | null = null,
  psLevel: number | null = null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pk = factors.practical_knowledge;
  const mk = factors.managerial_knowledge;
  const comm = factors.communication;
  const te = factors.thinking_environment;
  const tc = factors.thinking_challenge;
  const fta = factors.freedom_to_act;
  const mag = factors.magnitude;
  const noi = factors.nature_of_impact;

  // ---------- 1. KH 内部校验 (PK / MK / Comm) ----------
  // Excel: INDEX(KH_MATRIX, 1+3*(ceil(PK_pos/3)-1), 1+3*(ceil(MK_pos/3)-1)+(Comm-1))
  const pkPos = PK_SEQ.indexOf(pk) + 1;     // 1-based, 0 表示找不到
  const mkPos = MK_SEQ.indexOf(mk) + 1;
  const commInt = parseInt(stripSign(comm), 10);
  if (pkPos > 0 && mkPos > 0 && !isNaN(commInt)) {
    const row = pkRowOffset(pkPos) - 1;     // 转回 0-based 数组下标
    const col = 1 + 3 * (pkBaseGroup(mkPos) - 1) + (commInt - 1) - 1;
    const v = safeMatrixGet(KH_MATRIX, row, col);
    const level = levelFromMatrixValue(v);
    if (level) {
      issues.push({
        rule: 'kh',
        level,
        factors: ['practical_knowledge', 'managerial_knowledge', 'communication'],
        message: level === 'warn'
          ? `提醒: 专业知识 ${pk} + 管理知识 ${mk} + 沟通 ${comm} 这套组合按 Hay 规则不太常见 (严重)。`
          : `提醒: 专业知识 ${pk} + 管理知识 ${mk} + 沟通 ${comm} 这套组合按 Hay 规则较少见。`,
      });
    }
  }

  // ---------- 2. PS 内部校验 (TE / TC / 调整符号) ----------
  // Excel: INDEX(PS_MATRIX, ceil(TE_pos/3), 1+2*(ceil(TC_pos/3)-1)+symbol_offset)
  const tePos = TE_SEQ.indexOf(te) + 1;
  const tcPos = TC_SEQ.indexOf(tc) + 1;
  const symbol = computePsSymbol(tc, te);
  const symOffset = PS_SYMBOL_ORDER.indexOf(symbol) + 1;
  if (tePos > 0 && tcPos > 0 && symOffset > 0) {
    const row = pkBaseGroup(tePos) - 1;
    const col = 1 + 2 * (pkBaseGroup(tcPos) - 1) + (symOffset - 1) - 1;
    const v = safeMatrixGet(PS_MATRIX, row, col);
    const level = levelFromMatrixValue(v);
    if (level) {
      issues.push({
        rule: 'ps',
        level,
        factors: ['thinking_environment', 'thinking_challenge'],
        message: level === 'warn'
          ? `提醒: 思维环境 ${te} + 思维挑战 ${tc} 这套组合按 Hay 规则不太常见 (严重)。`
          : `提醒: 思维环境 ${te} + 思维挑战 ${tc} 这套组合按 Hay 规则较少见。`,
      });
    }
  }

  // ---------- 3. PS × KH 关系校验 ----------
  // 需要 khLevel 和 psLevel — 调用方从 job.result 拿
  if (khLevel != null && psLevel != null) {
    const psRow = PSXKH_PS_LEVELS.indexOf(psLevel);
    const khCol = PSXKH_KH_LEVELS.indexOf(khLevel);
    if (psRow >= 0 && khCol >= 0) {
      const v = safeMatrixGet(PSXKH_MATRIX, psRow, khCol);
      const level = levelFromMatrixValue(v);
      if (level) {
        issues.push({
          rule: 'ps_kh',
          level,
          factors: ['thinking_environment', 'thinking_challenge', 'practical_knowledge', 'managerial_knowledge', 'communication'],
          message: level === 'warn'
            ? `提醒: PS Level ${psLevel} 跟 KH Level ${khLevel} 这种比例按 Hay 规则不太常见 (严重)。可能解决问题分数相对知识技能过高或过低。`
            : `提醒: PS Level ${psLevel} 跟 KH Level ${khLevel} 这种比例按 Hay 规则较少见。`,
        });
      }
    }
  }

  // ---------- 4. ACC 内部校验 (FTA / NoI, 仅 Mag=N 时) ----------
  const ftaPos = FTA_SEQ.indexOf(fta) + 1;
  if (mag === 'N') {
    const noiPos = NOI_SEQ.indexOf(noi) + 1;
    if (ftaPos > 0 && noiPos > 0) {
      const row = pkRowOffset(ftaPos) - 1;
      const col = pkBaseGroup(noiPos) - 1;
      const v = safeMatrixGet(ACC_MATRIX, row, col);
      const level = levelFromMatrixValue(v);
      if (level) {
        issues.push({
          rule: 'acc',
          level,
          factors: ['freedom_to_act', 'nature_of_impact'],
          message: level === 'warn'
            ? `提醒: 行动自由度 ${fta} + 影响性质 ${noi} 这套组合按 Hay 规则不太常见 (严重)。`
            : `提醒: 行动自由度 ${fta} + 影响性质 ${noi} 这套组合按 Hay 规则较少见。`,
        });
      }
    }
  }

  // ---------- 5. 跨维度上限关系 (TE/FTA 不应高于 PK; FTA 不应高于 TE) ----------
  // Excel 规则: MATCH(Z, B4:B30) > MATCH(T, B4:B30) → 红
  if (tePos > 0 && pkPos > 0 && tePos > pkPos) {
    issues.push({
      rule: 'te_above_pk',
      level: 'error',
      factors: ['thinking_environment'],
      message: `按 Hay 规则，思维环境不应该高于专业知识。当前专业知识 ${pk}，思维环境 ${te}。`,
    });
  }
  if (ftaPos > 0 && pkPos > 0 && ftaPos > pkPos) {
    issues.push({
      rule: 'fta_above_pk',
      level: 'error',
      factors: ['freedom_to_act'],
      message: `按 Hay 规则，行动自由度不应该高于专业知识。当前专业知识 ${pk}，行动自由度 ${fta}。`,
    });
  }
  if (ftaPos > 0 && tePos > 0 && ftaPos > tePos) {
    issues.push({
      rule: 'fta_above_te',
      level: 'error',
      factors: ['freedom_to_act'],
      message: `按 Hay 规则，行动自由度不应该高于思维环境。当前思维环境 ${te}，行动自由度 ${fta}。`,
    });
  }

  return issues;
}

/** 计算 TC + TE 的符号调整结果 (复刻 Excel AB 列公式) — 用 N (中性) 或 + */
function computePsSymbol(tc: string, te: string): string {
  const tcSign = tc.endsWith('+') ? 1 : tc.endsWith('-') ? -1 : 0;
  const teSign = te.endsWith('+') ? 1 : te.endsWith('-') ? -1 : 0;
  return (tcSign + teSign) > 0 ? '+' : 'N';
}

/** 去掉档位的 +/- 符号 — '2+' → '2', 'D-' → 'D' */
function stripSign(s: string): string {
  return s ? s.replace(/[+-]$/, '') : '';
}

/** 安全访问二维数组 — 越界返回 null */
function safeMatrixGet(matrix: Array<Array<number | null>>, row: number, col: number): number | null {
  if (row < 0 || row >= matrix.length) return null;
  const r = matrix[row];
  if (col < 0 || col >= r.length) return null;
  return r[col];
}
