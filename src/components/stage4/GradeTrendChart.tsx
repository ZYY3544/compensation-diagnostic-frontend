/**
 * 职级薪酬趋势图 - 双视图版本
 * - 概览视图：差值柱状图（公司中位 vs 市场 P50 偏离百分比，5 档颜色）
 * - 详细视图：市场 P25-P75 带 + P50 虚线 + 员工散点 + 公司中位连线
 *
 * 切换按钮：
 * - 右上：概览 / 详细
 * - 左上：薪酬口径（TCC / 基本工资）
 *
 * 交互：
 * - 点击柱子 → 跳转详细视图并高亮该职级
 * - 点击散点/中位节点 → 切换高亮职级
 * - 悬停 → Tooltip
 */
import { useState, useMemo } from 'react';
import { ChartCard } from './ModuleShell';

interface AnonEmployee {
  id: string;
  level: string;
  salary: number;  // 万元
  dept: string;
  function?: string;
}

interface GradeTrendData {
  grades: string[];
  company_counts?: number[];
  company_actual: number[];
  company_trendline: number[];
  market_p25_actual: (number | null)[];
  market_p25_trendline: (number | null)[];
  market_p50_actual: (number | null)[];
  market_p50_trendline: (number | null)[];
  market_p75_actual: (number | null)[];
  market_p75_trendline: (number | null)[];
  annotations: Array<{ grade: string; type: string; text: string }>;
  storyline: string;
  employees_by_grade?: Record<string, AnonEmployee[]>;
}

// 方案 X：后端按部门预聚合，前端切换零请求
interface DeptBundle {
  overall?: GradeTrendData;
  by_department?: Record<string, GradeTrendData>;
  // 兼容老结构：data 可能直接是 GradeTrendData
  grades?: string[];
}

interface Props {
  tccData: DeptBundle | GradeTrendData;
  baseData: DeptBundle | GradeTrendData;
}

const ALL_DEPT = '__overall__';

// 把 props（DeptBundle 或老的 GradeTrendData）规整成 {dept: data} 字典
function normalizeBundle(input: DeptBundle | GradeTrendData | undefined): {
  overall: GradeTrendData | undefined;
  byDept: Record<string, GradeTrendData>;
} {
  if (!input) return { overall: undefined, byDept: {} };
  const asBundle = input as DeptBundle;
  if (asBundle.overall !== undefined || asBundle.by_department !== undefined) {
    return { overall: asBundle.overall, byDept: asBundle.by_department || {} };
  }
  // 老结构：直接是 GradeTrendData
  return { overall: input as GradeTrendData, byDept: {} };
}

// 颜色阈值（对应 CR 值 ±15% / ±5%）
const DEV_COLORS = {
  deepHigh: { bg: '#C2410C', label: '深橙' },     // > +15%
  lightHigh: { bg: '#FDBA74', label: '浅橙' },    // +5% ~ +15%
  neutral: { bg: '#CBD5E1', label: '灰' },        // -5% ~ +5%
  lightLow: { bg: '#FCA5A5', label: '浅红' },     // -15% ~ -5%
  deepLow: { bg: '#991B1B', label: '深红' },      // < -15%
};

const BRAND = '#D85A30';        // 品牌橙（员工散点）
const MEDIAN_COLOR = '#0F766E'; // 深青（公司中位线 + 三角节点，跟散点形状色都区分开）
const MARKET_GRAY = '#888780';

export default function GradeTrendChart({ tccData, baseData }: Props) {
  const tcc = useMemo(() => normalizeBundle(tccData), [tccData]);
  const base = useMemo(() => normalizeBundle(baseData), [baseData]);

  // 部门列表：取 tcc 和 base 都有的并集（一般两个 bundle 一致）
  const departments = useMemo(() => {
    const set = new Set<string>([
      ...Object.keys(tcc.byDept),
      ...Object.keys(base.byDept),
    ]);
    return [ALL_DEPT, ...Array.from(set).sort()];
  }, [tcc, base]);

  if (!tcc.overall || !tcc.overall.grades?.length) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ChartCard title="各职级 vs 市场分位">
        <OverviewSection tcc={tcc} base={base} departments={departments} />
      </ChartCard>
      <ChartCard title="员工分布与中位趋势">
        <DetailSection tcc={tcc} base={base} departments={departments} />
      </ChartCard>
    </div>
  );
}

// 选当前部门的 GradeTrendData：默认 overall；按部门时若无数据 fallback 到 overall
function pickData(bundle: { overall?: GradeTrendData; byDept: Record<string, GradeTrendData> },
                  dept: string): GradeTrendData | undefined {
  if (dept === ALL_DEPT) return bundle.overall;
  return bundle.byDept[dept] || bundle.overall;
}

// =========================================================================
// Section 1: 职级偏离柱状图（独立 toolbar：薪酬口径 / 分位 / 部门）
// =========================================================================
function OverviewSection({ tcc, base, departments }: {
  tcc: { overall?: GradeTrendData; byDept: Record<string, GradeTrendData> };
  base: { overall?: GradeTrendData; byDept: Record<string, GradeTrendData> };
  departments: string[];
}) {
  const [salaryType, setSalaryType] = useState<'tcc' | 'base'>('tcc');
  const [quartile, setQuartile] = useState<'p25' | 'p50' | 'p75'>('p50');
  const [dept, setDept] = useState<string>(ALL_DEPT);
  const data = pickData(salaryType === 'tcc' ? tcc : base, dept);
  if (!data || !data.grades?.length) return <EmptyHint text="该部门数据不足，无法画图。" />;

  return (
    <div>
      <Toolbar>
        <SegmentedControl
          options={[{ value: 'tcc', label: '年度总现金' }, { value: 'base', label: '年度基本工资' }]}
          value={salaryType}
          onChange={v => setSalaryType(v as 'tcc' | 'base')}
        />
        <SegmentedControl
          options={[{ value: 'p25', label: 'vs P25' }, { value: 'p50', label: 'vs P50' }, { value: 'p75', label: 'vs P75' }]}
          value={quartile}
          onChange={v => setQuartile(v as 'p25' | 'p50' | 'p75')}
        />
        <DeptSelect value={dept} onChange={setDept} options={departments} />
      </Toolbar>

      {data.storyline && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          {data.storyline}
        </div>
      )}

      <OverviewChart data={data} quartile={quartile} />
    </div>
  );
}

// =========================================================================
// Section 2: 详细趋势 + 散点（独立 toolbar：薪酬口径 / 部门）
// =========================================================================
function DetailSection({ tcc, base, departments }: {
  tcc: { overall?: GradeTrendData; byDept: Record<string, GradeTrendData> };
  base: { overall?: GradeTrendData; byDept: Record<string, GradeTrendData> };
  departments: string[];
}) {
  const [salaryType, setSalaryType] = useState<'tcc' | 'base'>('tcc');
  const [dept, setDept] = useState<string>(ALL_DEPT);
  const [highlightGrade, setHighlightGrade] = useState<string | null>(null);
  const data = pickData(salaryType === 'tcc' ? tcc : base, dept);
  if (!data || !data.grades?.length) return <EmptyHint text="该部门数据不足，无法画图。" />;

  return (
    <div>
      <Toolbar>
        <SegmentedControl
          options={[{ value: 'tcc', label: '年度总现金' }, { value: 'base', label: '年度基本工资' }]}
          value={salaryType}
          onChange={v => setSalaryType(v as 'tcc' | 'base')}
        />
        <DeptSelect value={dept} onChange={setDept} options={departments} />
      </Toolbar>

      <DetailChart data={data} highlightGrade={highlightGrade} onHighlight={setHighlightGrade} />
    </div>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
      flexWrap: 'wrap',
    }}>
      {children}
    </div>
  );
}

function DeptSelect({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        fontSize: 12, padding: '5px 10px', borderRadius: 6,
        border: '1px solid var(--border, #e5e7eb)',
        background: '#fff', color: 'var(--text-secondary, #475569)',
        cursor: 'pointer', minWidth: 120,
      }}>
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt === ALL_DEPT ? '公司整体' : opt}
        </option>
      ))}
    </select>
  );
}

// =========================================================================
// 概览视图：差值柱状图
// =========================================================================
function OverviewChart({ data, quartile = 'p50' }: {
  data: GradeTrendData;
  quartile?: 'p25' | 'p50' | 'p75';
}) {
  const { grades, company_actual, company_counts } = data;
  const marketSeries =
    quartile === 'p25' ? data.market_p25_actual :
    quartile === 'p75' ? data.market_p75_actual :
    data.market_p50_actual;
  const quartileLabel = quartile.toUpperCase();

  // 每个职级的偏离率（vs 选定分位）
  const deviations = useMemo(() => grades.map((g, i) => {
    const company = company_actual[i];
    const mkt = marketSeries[i];
    if (!company || !mkt || mkt <= 0) return { grade: g, pct: null as number | null, hasMarket: false };
    return { grade: g, pct: (company - mkt) / mkt * 100, hasMarket: true };
  }), [grades, company_actual, marketSeries]);

  const validPcts = deviations.map(d => d.pct).filter((v): v is number => v != null);
  if (validPcts.length === 0) {
    return <EmptyHint text="缺少市场数据，无法生成对比。" />;
  }

  // Y 轴范围：最大绝对值向上取整到 5 的倍数，至少 ±20%
  const maxAbs = Math.max(20, Math.ceil(Math.max(...validPcts.map(Math.abs)) / 5) * 5);
  const yMax = maxAbs, yMin = -maxAbs;

  const W = 640, H = 340;
  const pad = { top: 24, right: 24, bottom: 50, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const n = grades.length;
  const slotW = innerW / n;
  const barW = Math.min(44, slotW * 0.6);

  const yScale = (pct: number) =>
    pad.top + innerH - ((pct - yMin) / (yMax - yMin)) * innerH;
  const zeroY = yScale(0);

  // Y 轴刻度（步长 5 或 10）
  const step = maxAbs <= 20 ? 5 : maxAbs <= 50 ? 10 : 20;
  const ticks: number[] = [];
  for (let v = -maxAbs; v <= maxAbs; v += step) ticks.push(v);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', minHeight: 280 }}>
        {/* Y 网格 */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={yScale(v)} y2={yScale(v)}
              stroke={v === 0 ? '#94a3b8' : '#f0f0f4'} strokeDasharray={v === 0 ? undefined : '3 3'} />
            <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
              {v > 0 ? '+' : ''}{v}%
            </text>
          </g>
        ))}

        {/* 零线标签 */}
        <text x={W - pad.right + 4} y={zeroY + 4} fontSize={10} fill="#64748B">市场 {quartileLabel}</text>

        {/* 柱子 */}
        {deviations.map((d, i) => {
          const cx = pad.left + slotW * (i + 0.5);
          const count = company_counts?.[i] ?? 0;
          const lowSample = count < 3;
          const isHover = hoverIdx === i;

          if (!d.hasMarket) {
            // 缺少市场数据：灰色条带 + 提示
            return (
              <g key={d.grade}>
                <rect x={cx - barW / 2} y={zeroY - 2} width={barW} height={4}
                  fill="#E5E7EB" opacity={0.6} />
                <text x={cx} y={H - pad.bottom + 22} textAnchor="middle" fontSize={10} fill="#CBD5E1">
                  缺数据
                </text>
              </g>
            );
          }

          const pct = d.pct!;
          const color = deviationColor(pct);
          const topY = pct >= 0 ? yScale(pct) : zeroY;
          const barH = Math.max(Math.abs(yScale(pct) - zeroY), 1);
          const labelY = pct >= 0 ? topY - 6 : topY + barH + 14;

          return (
            <g key={d.grade}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <rect x={cx - barW / 2} y={topY} width={barW} height={barH}
                fill={color} rx={3} ry={3}
                opacity={isHover ? 0.85 : 1}
                stroke={isHover ? '#1f2937' : 'none'}
                strokeWidth={1}
              />
              {/* 顶端百分比 */}
              <text x={cx} y={labelY} textAnchor="middle" fontSize={11} fontWeight={600} fill="#334155">
                {pct > 0 ? '+' : ''}{Math.round(pct)}%
              </text>
              {/* X 轴：职级 + 样本量 */}
              <text x={cx} y={H - pad.bottom + 22} textAnchor="middle" fontSize={11}
                fill={lowSample ? '#CBD5E1' : '#475569'} fontWeight={500}>
                {d.grade} ({count})
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx != null && deviations[hoverIdx].hasMarket && (() => {
        const d = deviations[hoverIdx];
        const company = company_actual[hoverIdx];
        const mkt = marketSeries[hoverIdx];
        const count = company_counts?.[hoverIdx] ?? 0;
        return (
          <div style={tooltipStyle(hoverIdx, n)}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.grade}</div>
            <div>公司中位：{(company / 10000).toFixed(1)} 万</div>
            <div>市场 {quartileLabel}：{(mkt! / 10000).toFixed(1)} 万</div>
            <div>样本量：{count} 人</div>
            <div style={{ marginTop: 4, color: d.pct! < 0 ? '#991B1B' : '#C2410C', fontWeight: 600 }}>
              偏离 {d.pct! > 0 ? '+' : ''}{d.pct!.toFixed(1)}%
            </div>
          </div>
        );
      })()}

      {/* 图例 */}
      <div style={{
        display: 'flex', gap: 14, marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
        flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <LegendSwatch color={DEV_COLORS.deepLow.bg} label="< -15% (明显偏低)" />
        <LegendSwatch color={DEV_COLORS.lightLow.bg} label="-15% ~ -5%" />
        <LegendSwatch color={DEV_COLORS.neutral.bg} label="±5% (贴近市场)" />
        <LegendSwatch color={DEV_COLORS.lightHigh.bg} label="+5% ~ +15%" />
        <LegendSwatch color={DEV_COLORS.deepHigh.bg} label="> +15% (明显偏高)" />
      </div>

    </div>
  );
}

// =========================================================================
// 详细视图：散点 + 中位连线 + 市场带
// =========================================================================
function DetailChart({ data, highlightGrade, onHighlight }: {
  data: GradeTrendData;
  highlightGrade: string | null;
  onHighlight: (g: string | null) => void;
}) {
  const {
    grades, company_actual, company_counts,
    market_p25_actual, market_p50_actual, market_p75_actual,
    employees_by_grade = {},
  } = data;

  const n = grades.length;

  // 全部要进 Y 轴的值（万元）
  const allVals: number[] = [];
  for (const v of company_actual) if (v && v > 0) allVals.push(v / 10000);
  for (const v of market_p25_actual) if (v && v > 0) allVals.push(v / 10000);
  for (const v of market_p75_actual) if (v && v > 0) allVals.push(v / 10000);
  for (const g of grades) {
    for (const e of employees_by_grade[g] || []) allVals.push(e.salary);
  }
  if (allVals.length === 0) return <EmptyHint text="缺少数据。" />;

  const yMax = Math.max(...allVals) * 1.12;

  const W = 640, H = 360;
  const pad = { top: 24, right: 24, bottom: 50, left: 56 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / Math.max(n - 1, 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - (v / yMax) * innerH;

  // Y 轴刻度（以万元为单位）
  const step = _niceStep(yMax, 5);
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  // 市场带 P25-P75
  const bandPath = (() => {
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i < n; i++) {
      const p75 = market_p75_actual[i];
      const p25 = market_p25_actual[i];
      if (p75 && p25 && p75 > 0 && p25 > 0) {
        top.push(`${xScale(i)},${yScale(p75 / 10000)}`);
        bot.unshift(`${xScale(i)},${yScale(p25 / 10000)}`);
      }
    }
    if (top.length < 2) return '';
    return `M${top.join(' L')} L${bot.join(' L')} Z`;
  })();

  // P50 虚线
  const p50Path = (() => {
    const pts = market_p50_actual
      .map((v, i) => v && v > 0 ? `${xScale(i)},${yScale(v / 10000)}` : null)
      .filter(Boolean);
    return pts.length >= 2 ? `M${pts.join(' L')}` : '';
  })();

  // 公司中位连线（小样本用虚线断开）
  const companyPath = (() => {
    const segs: string[] = [];
    let current: string[] = [];
    for (let i = 0; i < n; i++) {
      const v = company_actual[i];
      const count = company_counts?.[i] ?? 0;
      if (v && v > 0 && count >= 3) {
        current.push(`${xScale(i)},${yScale(v / 10000)}`);
      } else {
        if (current.length >= 2) segs.push(`M${current.join(' L')}`);
        current = [];
      }
    }
    if (current.length >= 2) segs.push(`M${current.join(' L')}`);
    return segs.join(' ');
  })();

  const [hover, setHover] = useState<
    | { type: 'scatter'; grade: string; emp: AnonEmployee; x: number; y: number }
    | { type: 'node'; grade: string; i: number; x: number; y: number }
    | null
  >(null);

  // 状态条文案
  const statusText = (() => {
    if (!highlightGrade) return '点击任一职级可聚焦该职级员工分布';
    const i = grades.indexOf(highlightGrade);
    if (i < 0) return '';
    const company = company_actual[i];
    const mkt = market_p50_actual[i];
    const count = company_counts?.[i] ?? 0;
    if (!company || !mkt) return `当前高亮：${highlightGrade}`;
    const dev = (company - mkt) / mkt * 100;
    const dir = dev >= 0 ? '高于' : '低于';
    return `当前高亮：${highlightGrade} · ${count} 人 · 中位值 ${(company / 10000).toFixed(1)} 万，${dir}市场 P50 约 ${Math.abs(Math.round(dev))}%`;
  })();

  return (
    <div>
      {/* 状态条 */}
      <div style={{
        fontSize: 12, color: 'var(--text-muted)', marginBottom: 8,
        padding: '6px 10px', background: '#F8FAFC', borderRadius: 6,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{statusText}</span>
        {highlightGrade && (
          <button onClick={() => onHighlight(null)} style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 4,
            border: '1px solid var(--border)', background: '#fff', cursor: 'pointer',
            color: 'var(--text-muted)',
          }}>
            清除高亮
          </button>
        )}
      </div>

      {/* 图例 */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 8, fontSize: 11,
        color: 'var(--text-muted)', flexWrap: 'wrap',
      }}>
        <LegendBand />
        <LegendLine color={MARKET_GRAY} dashed label="市场 P50" />
        <LegendDot color={BRAND} label="员工散点" />
        <LegendTriangleLine color={MEDIAN_COLOR} label="公司中位" />
      </div>

      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', minHeight: 280 }}>
          {/* Y 网格 + 刻度 */}
          {yTicks.map(v => (
            <g key={v}>
              <line x1={pad.left} x2={W - pad.right} y1={yScale(v)} y2={yScale(v)}
                stroke="#f0f0f4" strokeDasharray="3 3" />
              <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="#94a3b8">
                {v.toFixed(v >= 100 ? 0 : 1)} 万
              </text>
            </g>
          ))}

          {/* 市场 P25-P75 带 */}
          {bandPath && <path d={bandPath} fill={MARKET_GRAY} opacity={0.18} />}

          {/* 市场 P50 虚线 */}
          {p50Path && (
            <path d={p50Path} fill="none" stroke={MARKET_GRAY} strokeWidth={1.5}
              strokeDasharray="6 4" />
          )}

          {/* 员工散点 */}
          {grades.map((g, gi) => {
            const emps = employees_by_grade[g] || [];
            const isHighlighted = highlightGrade === g;
            const noHighlight = highlightGrade == null;
            const opacity = noHighlight ? 0.6 : isHighlighted ? 0.85 : 0.18;
            const r = noHighlight ? 4 : isHighlighted ? 5 : 3.5;
            return emps.map((emp, ei) => {
              // 同职级所有散点对齐在职级的垂直线上（不再做横向抖动）
              const cx = xScale(gi);
              const cy = yScale(emp.salary);
              return (
                <circle key={`${g}-${ei}`} cx={cx} cy={cy} r={r}
                  fill={BRAND} opacity={opacity}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onHighlight(g)}
                  onMouseEnter={() => setHover({ type: 'scatter', grade: g, emp, x: cx, y: cy })}
                  onMouseLeave={() => setHover(null)}
                />
              );
            });
          })}

          {/* 公司中位连线（主线） */}
          {companyPath && (
            <path d={companyPath} fill="none" stroke={MEDIAN_COLOR} strokeWidth={3}
              strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* 小样本职级的连线用虚线连过去（补全视觉） */}
          {grades.map((g, i) => {
            const v = company_actual[i];
            const count = company_counts?.[i] ?? 0;
            if (!v || v <= 0 || count >= 3 || i === 0) return null;
            const prevV = company_actual[i - 1];
            if (!prevV || prevV <= 0) return null;
            return (
              <line key={`dash-${g}`}
                x1={xScale(i - 1)} y1={yScale(prevV / 10000)}
                x2={xScale(i)} y2={yScale(v / 10000)}
                stroke={MEDIAN_COLOR} strokeWidth={2} strokeDasharray="5 4" opacity={0.5} />
            );
          })}

          {/* 公司中位节点：三角形，跟员工散点（圆形）区分 */}
          {grades.map((g, i) => {
            const v = company_actual[i];
            const count = company_counts?.[i] ?? 0;
            if (!v || v <= 0) return null;
            const cx = xScale(i), cy = yScale(v / 10000);
            const isHighlighted = highlightGrade === g;
            const r = isHighlighted ? 7 : 5;
            // 向上的等腰三角形，视觉中心对齐 (cx, cy)
            const points = `${cx},${cy - r} ${cx - r},${cy + r * 0.8} ${cx + r},${cy + r * 0.8}`;
            return (
              <polygon key={g} points={points}
                fill={count < 3 ? '#fff' : MEDIAN_COLOR}
                stroke={MEDIAN_COLOR} strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onClick={() => onHighlight(g)}
                onMouseEnter={() => setHover({ type: 'node', grade: g, i, x: cx, y: cy })}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {/* X 轴标签 */}
          {grades.map((g, i) => {
            const count = company_counts?.[i] ?? 0;
            const lowSample = count < 3;
            return (
              <text key={g} x={xScale(i)} y={H - pad.bottom + 22} textAnchor="middle" fontSize={11}
                fill={highlightGrade === g ? MEDIAN_COLOR : lowSample ? '#CBD5E1' : '#475569'}
                fontWeight={highlightGrade === g ? 700 : 500}>
                {g} ({count})
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hover && <DetailTooltip hover={hover} data={data} />}
      </div>
    </div>
  );
}

// =========================================================================
// Tooltip
// =========================================================================
function DetailTooltip({ hover, data }: {
  hover: any;
  data: GradeTrendData;
}) {
  const W = 640;
  const leftPct = (hover.x / W) * 100;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${leftPct}%`, top: hover.y,
    transform: leftPct > 70 ? 'translate(-110%, -50%)' : 'translate(10%, -50%)',
    background: 'rgba(17, 24, 39, 0.94)', color: '#fff',
    padding: '8px 12px', borderRadius: 6, fontSize: 12,
    pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  };

  if (hover.type === 'scatter') {
    const { grade, emp } = hover;
    const i = data.grades.indexOf(grade);
    const p25 = data.market_p25_actual[i];
    const p50 = data.market_p50_actual[i];
    const p75 = data.market_p75_actual[i];
    let relPos = '';
    if (p25 && p50 && p75) {
      const salY = emp.salary * 10000;
      if (salY < p25) relPos = '低于 P25';
      else if (salY < p50) relPos = 'P25-P50 之间';
      else if (salY < p75) relPos = 'P50-P75 之间';
      else relPos = '高于 P75';
    }
    return (
      <div style={style}>
        <div style={{ fontWeight: 600 }}>员工 #{emp.id} · {emp.dept}</div>
        <div>薪酬：{emp.salary.toFixed(1)} 万</div>
        {relPos && <div style={{ opacity: 0.8 }}>市场位置：{relPos}</div>}
      </div>
    );
  }

  if (hover.type === 'node') {
    const { grade, i } = hover;
    const count = data.company_counts?.[i] ?? 0;
    const company = data.company_actual[i];
    const p50 = data.market_p50_actual[i];
    const dev = p50 && p50 > 0 ? (company - p50) / p50 * 100 : null;
    return (
      <div style={style}>
        <div style={{ fontWeight: 600 }}>{grade} 公司中位</div>
        <div>公司中位：{(company / 10000).toFixed(1)} 万</div>
        {p50 != null && <div>市场 P50：{(p50 / 10000).toFixed(1)} 万</div>}
        {dev != null && (
          <div>偏离：{dev > 0 ? '+' : ''}{dev.toFixed(1)}%</div>
        )}
        <div>样本量：{count} 人{count < 3 ? '（过小，参考价值有限）' : ''}</div>
      </div>
    );
  }

  return null;
}

// =========================================================================
// 辅助组件
// =========================================================================
function SegmentedControl({ options, value, onChange }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            style={{
              fontSize: 12, padding: '5px 14px', borderRadius: 6,
              border: active ? '1px solid var(--blue, #3b82f6)' : '1px solid var(--border, #e5e7eb)',
              background: active ? '#EFF6FF' : '#fff',
              color: active ? 'var(--blue, #2563eb)' : 'var(--text-secondary, #475569)',
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{ width: 12, height: 12, background: color, borderRadius: 2, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function LegendBand() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 20, height: 10, background: MARKET_GRAY, opacity: 0.18,
        border: `1px solid ${MARKET_GRAY}`, borderStyle: 'solid',
      }} />
      市场 P25-P75
    </span>
  );
}

function LegendLine({ color, dashed, width = 2, label }: {
  color: string; dashed?: boolean; width?: number; label: string;
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width={20} height={10}>
        <line x1={0} x2={20} y1={5} y2={5} stroke={color} strokeWidth={width}
          strokeDasharray={dashed ? '4 3' : undefined} />
      </svg>
      {label}
    </span>
  );
}

function LegendTriangleLine({ color, label }: { color: string; label: string }) {
  // 图例：小三角 + 短连线，对应图里的三角节点 + 中位连线
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width={26} height={12}>
        <line x1={0} x2={26} y1={6} y2={6} stroke={color} strokeWidth={3} />
        <polygon points="13,2 8,10 18,10" fill={color} stroke={color} strokeWidth={1} />
      </svg>
      {label}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width={12} height={12}>
        <circle cx={6} cy={6} r={4} fill={color} opacity={0.7} />
      </svg>
      {label}
    </span>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{
      padding: '48px 16px', textAlign: 'center',
      fontSize: 13, color: 'var(--text-muted)',
    }}>
      {text}
    </div>
  );
}

// =========================================================================
// 工具
// =========================================================================
function deviationColor(pct: number): string {
  if (pct > 15) return DEV_COLORS.deepHigh.bg;
  if (pct > 5) return DEV_COLORS.lightHigh.bg;
  if (pct >= -5) return DEV_COLORS.neutral.bg;
  if (pct >= -15) return DEV_COLORS.lightLow.bg;
  return DEV_COLORS.deepLow.bg;
}

function tooltipStyle(idx: number, total: number): React.CSSProperties {
  const leftPct = ((idx + 0.5) / total) * 100;
  return {
    position: 'absolute',
    left: `${leftPct}%`, top: 0,
    transform: leftPct > 70 ? 'translate(-110%, 0)' : 'translate(10%, 0)',
    background: 'rgba(17, 24, 39, 0.94)', color: '#fff',
    padding: '8px 12px', borderRadius: 6, fontSize: 12,
    pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    minWidth: 140,
  };
}

function _niceStep(max: number, targetTicks: number): number {
  const rough = max / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let nice: number;
  if (norm <= 1.5) nice = 1;
  else if (norm <= 3.5) nice = 2;
  else if (norm <= 7.5) nice = 5;
  else nice = 10;
  return nice * mag;
}
