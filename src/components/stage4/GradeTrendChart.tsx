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

interface Props {
  tccData: GradeTrendData;
  baseData: GradeTrendData;
}

// 颜色阈值（对应 CR 值 ±15% / ±5%）
const DEV_COLORS = {
  deepHigh: { bg: '#C2410C', label: '深橙' },     // > +15%
  lightHigh: { bg: '#FDBA74', label: '浅橙' },    // +5% ~ +15%
  neutral: { bg: '#CBD5E1', label: '灰' },        // -5% ~ +5%
  lightLow: { bg: '#FCA5A5', label: '浅红' },     // -15% ~ -5%
  deepLow: { bg: '#991B1B', label: '深红' },      // < -15%
};

const BRAND = '#D85A30';        // 品牌橙
const BRAND_DEEP = '#993C1D';   // 深橙（连线）
const MARKET_GRAY = '#888780';

export default function GradeTrendChart({ tccData, baseData }: Props) {
  const [view, setView] = useState<'overview' | 'detail'>('overview');
  const [salaryType, setSalaryType] = useState<'tcc' | 'base'>('tcc');
  const [highlightGrade, setHighlightGrade] = useState<string | null>(null);

  const data = salaryType === 'tcc' ? tccData : baseData;
  if (!data || !data.grades || data.grades.length === 0) return null;

  const handleBarClick = (grade: string) => {
    setHighlightGrade(grade);
    setView('detail');
  };

  return (
    <div>
      {/* 顶部工具栏：左=口径切换，右=视图切换 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, flexWrap: 'wrap', gap: 8,
      }}>
        <SegmentedControl
          options={[{ value: 'tcc', label: '年度总现金' }, { value: 'base', label: '年度基本工资' }]}
          value={salaryType}
          onChange={v => setSalaryType(v as 'tcc' | 'base')}
        />
        <SegmentedControl
          options={[{ value: 'overview', label: '概览视图' }, { value: 'detail', label: '详细视图' }]}
          value={view}
          onChange={v => setView(v as 'overview' | 'detail')}
        />
      </div>

      {/* Storyline */}
      {data.storyline && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          {data.storyline}
        </div>
      )}

      {view === 'overview' ? (
        <OverviewChart data={data} onBarClick={handleBarClick} />
      ) : (
        <DetailChart
          data={data}
          highlightGrade={highlightGrade}
          onHighlight={setHighlightGrade}
        />
      )}
    </div>
  );
}

// =========================================================================
// 概览视图：差值柱状图
// =========================================================================
function OverviewChart({ data, onBarClick }: {
  data: GradeTrendData;
  onBarClick: (grade: string) => void;
}) {
  const { grades, company_actual, market_p50_actual, company_counts } = data;

  // 每个职级的偏离率
  const deviations = useMemo(() => grades.map((g, i) => {
    const company = company_actual[i];
    const mkt = market_p50_actual[i];
    if (!company || !mkt || mkt <= 0) return { grade: g, pct: null as number | null, hasMarket: false };
    return { grade: g, pct: (company - mkt) / mkt * 100, hasMarket: true };
  }), [grades, company_actual, market_p50_actual]);

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
        <text x={W - pad.right + 4} y={zeroY + 4} fontSize={10} fill="#64748B">市场 P50</text>

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
              style={{ cursor: 'pointer' }}
              onClick={() => onBarClick(d.grade)}
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
        const mkt = market_p50_actual[hoverIdx];
        const count = company_counts?.[hoverIdx] ?? 0;
        return (
          <div style={tooltipStyle(hoverIdx, n)}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.grade}</div>
            <div>公司中位：{(company / 10000).toFixed(1)} 万</div>
            <div>市场 P50：{(mkt! / 10000).toFixed(1)} 万</div>
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

      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, textAlign: 'center' }}>
        点击任一柱子可切换到详细视图聚焦该职级
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
        <LegendLine color={BRAND_DEEP} width={3} label="公司中位连线" />
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
              // 同一职级内 X 方向做一点点抖动避免重叠
              const jitter = emps.length > 1 ? ((ei % 5) - 2) * 3 : 0;
              const cx = xScale(gi) + jitter;
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
            <path d={companyPath} fill="none" stroke={BRAND_DEEP} strokeWidth={3}
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
                stroke={BRAND_DEEP} strokeWidth={2} strokeDasharray="5 4" opacity={0.5} />
            );
          })}

          {/* 公司中位节点 */}
          {grades.map((g, i) => {
            const v = company_actual[i];
            const count = company_counts?.[i] ?? 0;
            if (!v || v <= 0) return null;
            const cx = xScale(i), cy = yScale(v / 10000);
            const isHighlighted = highlightGrade === g;
            const r = isHighlighted ? 6 : 4;
            return (
              <circle key={g} cx={cx} cy={cy} r={r}
                fill={count < 3 ? '#fff' : BRAND_DEEP}
                stroke={BRAND_DEEP} strokeWidth={2}
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
                fill={highlightGrade === g ? BRAND_DEEP : lowSample ? '#CBD5E1' : '#475569'}
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
