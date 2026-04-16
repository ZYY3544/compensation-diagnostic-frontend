/**
 * 职级薪酬趋势图：公司薪酬曲线 vs 市场 P25/P50/P75 分布带。
 * 支持切换 TCC / 基本工资口径，以及是否显示原始折线（vs 只显示趋势线）。
 */
import { useState } from 'react';

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
}

interface Props {
  tccData: GradeTrendData;
  baseData: GradeTrendData;
}

export default function GradeTrendChart({ tccData, baseData }: Props) {
  const [salaryType, setSalaryType] = useState<'tcc' | 'base'>('tcc');
  const [showRawLine, setShowRawLine] = useState(false);

  const data = salaryType === 'tcc' ? tccData : baseData;
  if (!data || !data.grades || data.grades.length === 0) return null;

  const { grades, company_actual, company_trendline, company_counts,
    market_p25_trendline, market_p50_trendline, market_p75_trendline,
    annotations, storyline } = data;

  // 收集所有有效值算 Y 轴范围
  const allVals: number[] = [];
  for (const arr of [company_actual, company_trendline, market_p25_trendline, market_p50_trendline, market_p75_trendline]) {
    for (const v of arr) if (v && v > 0) allVals.push(v);
  }
  if (allVals.length === 0) return null;

  const yMin = 0;
  const yMax = Math.max(...allVals) * 1.12;

  const W = 640, H = 320;
  const pad = { top: 50, right: 100, bottom: 50, left: 65 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / Math.max(grades.length - 1, 1)) * innerW;
  const yScale = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const toPath = (vals: (number | null)[], close?: boolean): string => {
    const points = vals.map((v, i) => (v && v > 0) ? `${xScale(i)},${yScale(v)}` : null).filter(Boolean);
    if (points.length < 2) return '';
    if (close) {
      return `M${points[0]} L${points.join(' L')} L${xScale(grades.length - 1)},${yScale(0)} L${xScale(0)},${yScale(0)} Z`;
    }
    return `M${points.join(' L')}`;
  };

  // 市场分布带 path（P25 底 → P75 顶）
  const bandPath = (() => {
    const p75Points: string[] = [];
    const p25Points: string[] = [];
    for (let i = 0; i < grades.length; i++) {
      const p75 = market_p75_trendline[i];
      const p25 = market_p25_trendline[i];
      if (p75 && p75 > 0 && p25 && p25 > 0) {
        p75Points.push(`${xScale(i)},${yScale(p75)}`);
        p25Points.unshift(`${xScale(i)},${yScale(p25)}`);
      }
    }
    if (p75Points.length < 2) return '';
    return `M${p75Points.join(' L')} L${p25Points.join(' L')} Z`;
  })();

  // Y 轴刻度
  const yTicks: number[] = [];
  const step = _niceStep(yMax, 5);
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  // Annotation → 图上标注位置
  const annotationMap = new Map<string, string>();
  for (const a of annotations) annotationMap.set(a.grade, a.text);

  return (
    <div>
      {/* 切换按钮 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['tcc', 'base'] as const).map(t => (
            <button
              key={t}
              onClick={() => setSalaryType(t)}
              style={{
                fontSize: 12, padding: '5px 14px', borderRadius: 6,
                border: salaryType === t ? '1px solid var(--blue)' : '1px solid var(--border)',
                background: salaryType === t ? '#EFF6FF' : '#fff',
                color: salaryType === t ? 'var(--blue)' : 'var(--text-secondary)',
                fontWeight: salaryType === t ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {t === 'tcc' ? '年度总现金' : '年度基本工资'}
            </button>
          ))}
        </div>
        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showRawLine}
            onChange={e => setShowRawLine(e.target.checked)}
            style={{ accentColor: 'var(--brand)' }}
          />
          显示原始折线
        </label>
      </div>

      {/* Storyline：图上方一句话核心结论 */}
      {storyline && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
          {storyline}
        </div>
      )}

      {/* SVG 趋势图 */}
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Y 轴网格 + 标签 */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={pad.left} x2={W - pad.right} y1={yScale(v)} y2={yScale(v)} stroke="#f0f0f4" strokeDasharray="3 3" />
            <text x={pad.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="#a0a0b0">
              {v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}万` : v.toLocaleString()}
            </text>
          </g>
        ))}

        {/* X 轴标签 */}
        {grades.map((g, i) => {
          const count = company_counts?.[i];
          const lowSample = count != null && count < 3;
          return (
            <text key={g} x={xScale(i)} y={H - pad.bottom + 20} textAnchor="middle" fontSize={11}
              fill={lowSample ? '#CBD5E1' : '#6b6b7e'}>
              {g}{count != null ? ` (${count})` : ''}
            </text>
          );
        })}

        {/* 市场分布带 P25-P75 */}
        {bandPath && <path d={bandPath} fill="#F1F5F9" opacity={0.7} />}

        {/* 市场 P75 趋势线 */}
        <path d={toPath(market_p75_trendline)} fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="6 4" />
        {/* 市场 P50 趋势线 */}
        <path d={toPath(market_p50_trendline)} fill="none" stroke="#64748B" strokeWidth={2} />
        {/* 市场 P25 趋势线 */}
        <path d={toPath(market_p25_trendline)} fill="none" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="6 4" />

        {/* 公司原始折线（可选显示，虚线） */}
        {showRawLine && (
          <>
            <path d={toPath(company_actual)} fill="none" stroke="#D35400" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.5} />
            {company_actual.map((v, i) => {
              if (!v || v <= 0) return null;
              const lowSample = company_counts && company_counts[i] < 3;
              return (
                <circle key={i} cx={xScale(i)} cy={yScale(v)} r={lowSample ? 3 : 4}
                  fill={lowSample ? 'none' : '#D35400'} stroke="#D35400" strokeWidth={1.5} opacity={0.6} />
              );
            })}
          </>
        )}

        {/* 公司趋势线（粗，品牌橙色） */}
        <path d={toPath(company_trendline)} fill="none" stroke="#D35400" strokeWidth={3} />

        {/* Annotation 标注点 */}
        {annotations.map((a, ai) => {
          const gi = grades.indexOf(a.grade);
          if (gi < 0) return null;
          const cy = company_actual[gi] ? yScale(company_actual[gi]) : yScale(company_trendline[gi]);
          const offsetY = a.type === 'above_p75' ? -22 : 18;
          return (
            <g key={ai}>
              <circle cx={xScale(gi)} cy={cy} r={5} fill="#fff" stroke="#D35400" strokeWidth={2} />
              <text x={xScale(gi)} y={cy + offsetY} textAnchor="middle" fontSize={10} fill="#64748B" fontWeight={500}>
                {a.text}
              </text>
            </g>
          );
        })}

        {/* 图例 */}
        <g transform={`translate(${W - pad.right + 12}, ${pad.top})`}>
          <line x1={0} x2={20} y1={0} y2={0} stroke="#D35400" strokeWidth={3} />
          <text x={24} y={4} fontSize={10} fill="#64748B">公司</text>
          <line x1={0} x2={20} y1={20} y2={20} stroke="#64748B" strokeWidth={2} />
          <text x={24} y={24} fontSize={10} fill="#64748B">P50</text>
          <line x1={0} x2={20} y1={40} y2={40} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={24} y={44} fontSize={10} fill="#a0a0b0">P25/P75</text>
          <rect x={0} y={56} width={20} height={10} fill="#F1F5F9" stroke="#E2E8F0" />
          <text x={24} y={64} fontSize={10} fill="#a0a0b0">市场带</text>
        </g>
      </svg>
    </div>
  );
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
