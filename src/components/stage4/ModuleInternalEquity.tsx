import { useEffect, useRef, useState } from 'react';
import ModuleShell, { ChartCard } from './ModuleShell';

// 品牌色家族：跟 Sparky 像素猫 logo 的棕橙色对齐
const BOX_HIGH = '#D85A30';        // 离散度偏高：品牌橙（警示色）
const BOX_HIGH_FILL = '#FEF2EE';   // 偏高盒子的浅橙底
const BOX_NORMAL = '#A8604A';      // 正常：Sparky 深棕橙（像素猫阴影色）
const BOX_NORMAL_FILL = '#F8EADF'; // 正常盒子的浅棕底
const TEXT_PRIMARY = '#0F172A';
const TEXT_MUTED = '#94A3B8';
const TEXT_SUB = '#64748B';

export default function ModuleInternalEquity({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const [salaryType, setSalaryType] = useState<'base' | 'tcc'>('base');
  // 范围 filter：'__overall__' | 'dept:<name>' | 'func:<name>'
  const [scope, setScope] = useState<string>('__overall__');

  // 从 views 里按 salaryType + scope 切出当前视图
  const view = pickView(data, salaryType, scope);
  const dispersion = view?.dispersion || data?.dispersion || [];
  const boxplot = view?.boxplot || data?.boxplot || [];
  const gradeDeptMedians = view?.grade_dept_medians || data?.grade_dept_medians || {
    grades: [], departments: [], values: [], overall_medians: [],
  };
  const highCount = view?.high_dispersion_count ?? data?.high_dispersion_count ?? 0;
  const totalGrades = dispersion.length;

  const subtitleParts: string[] = [];
  subtitleParts.push(`共 ${totalGrades} 个层级`);
  if (highCount > 0) subtitleParts.push(`${highCount} 个离散度偏高`);
  else subtitleParts.push('整体离散度正常');
  const subtitle = subtitleParts.join(' · ');

  // Boxplot 发现：用 P75/P25 倍数衡量"中间 50% 员工的薪酬跨度"——盒子越长，
  // 这一级内部薪酬差异越大。
  let boxFinding = '';
  if (boxplot.length > 0) {
    const withIqr = boxplot
      .filter((b: any) => b.q1 > 0 && b.q3 > 0)
      .map((b: any) => ({ ...b, iqrRatio: b.q3 / b.q1 }));
    if (withIqr.length > 0) {
      const sorted = [...withIqr].sort((a, b) => b.iqrRatio - a.iqrRatio);
      const top = sorted[0];
      boxFinding = `${top.grade} 这一级内部薪酬跨度最大（中间 50% 员工 P75/P25 = ${top.iqrRatio.toFixed(1)} 倍）`;
    }
  }

  // 离散系数表格发现：离散系数最高的层级
  let dispFinding = '';
  if (dispersion.length > 0) {
    const withCoef = dispersion.filter((d: any) => d.coefficient != null);
    if (withCoef.length > 0) {
      const sorted = [...withCoef].sort((a, b) => b.coefficient - a.coefficient);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      dispFinding = `离散系数最高的是 ${top.grade}（${top.coefficient}），最低的是 ${bottom.grade}（${bottom.coefficient}）`;
    }
  }


  return (
    <ModuleShell
      title="内部公平性分析"
      subtitle={subtitle}
      insight={insight}
      insightLoading={insightLoading}
    >
      {/* 薪酬口径 + 范围（部门/职能）筛选 —— 对模块内所有图表生效 */}
      {data?.views && (
        <ModuleToolbar
          salaryType={salaryType} onSalaryChange={setSalaryType}
          scope={scope} onScopeChange={setScope}
          departments={data?.departments || []}
          functions={data?.functions || []}
        />
      )}

      {boxplot.length > 0 && (
        <BoxPlotSection boxplot={boxplot} finding={boxFinding} />
      )}

      {dispersion.length > 0 && (
        <ChartCard title="各层级离散度" finding={dispFinding}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>层级</th>
                <th style={{ textAlign: 'center', padding: '8px' }}>人数</th>
                <th style={{ textAlign: 'center', padding: '8px' }}>均值</th>
                <th style={{ textAlign: 'center', padding: '8px' }}>离散系数</th>
                <th style={{ textAlign: 'center', padding: '8px' }}>极差比</th>
                <th style={{ textAlign: 'center', padding: '8px' }}>状态</th>
              </tr>
            </thead>
            <tbody>
              {dispersion.map((d: any) => (
                <tr key={d.grade} style={{ borderBottom: '1px solid #f5f5f5', background: d.status === 'high' ? '#FEF3C7' : '#fff' }}>
                  <td style={{ padding: '8px', fontWeight: 500 }}>{d.grade}</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{d.count}</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>¥{d.mean?.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', padding: '8px', fontWeight: d.status === 'high' ? 700 : 400, color: d.status === 'high' ? '#DC2626' : 'inherit' }}>{d.coefficient}</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{d.range_ratio}x</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>
                    {d.status === 'high'
                      ? <span style={{ color: '#DC2626', fontWeight: 600 }}>偏高</span>
                      : <span style={{ color: 'var(--green)' }}>正常</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      )}

      {gradeDeptMedians.grades.length > 0 && gradeDeptMedians.departments.length > 0 && (
        <GradeDeptMatrix data={gradeDeptMedians} />
      )}
    </ModuleShell>
  );
}

// =========================================================================
// 职级 × 部门 中位值矩阵：行=职级，列=部门，最右列=公司整体中位
// 支持"绝对值"和"相对比例"两种显示模式切换
// =========================================================================
interface GDMatrixData {
  grades: string[];
  departments: string[];
  values: (number | null)[][];        // [gradeIdx][deptIdx] 绝对中位
  overall_medians: (number | null)[]; // [gradeIdx] 公司整体中位
}

function GradeDeptMatrix({ data }: { data: GDMatrixData }) {
  const [mode, setMode] = useState<'absolute' | 'relative'>('absolute');

  const { grades, departments, values, overall_medians } = data;

  const fmtMoney = (v: number) => v >= 10000
    ? `${(v / 10000).toFixed(v >= 1000000 ? 0 : 1)}万`
    : `${Math.round(v).toLocaleString()}`;

  // 相对比例颜色：< 0.9 偏低红，0.9-1.1 绿，1.1-1.3 浅橙，> 1.3 深橙
  const ratioColor = (r: number): { bg: string; fg: string } => {
    if (r < 0.9) return { bg: '#FEE2E2', fg: '#991B1B' };
    if (r <= 1.1) return { bg: '#D1FAE5', fg: '#065F46' };
    if (r <= 1.3) return { bg: '#FED7AA', fg: '#9A3412' };
    return { bg: '#FEF2EE', fg: '#C2410C' };
  };

  const finding = (() => {
    // 找偏离最大的格子
    let maxAbs = 0;
    let maxCell = '';
    for (let gi = 0; gi < grades.length; gi++) {
      const overall = overall_medians[gi];
      if (!overall) continue;
      for (let di = 0; di < departments.length; di++) {
        const v = values[gi]?.[di];
        if (v == null) continue;
        const ratio = v / overall;
        const abs = Math.abs(ratio - 1);
        if (abs > maxAbs) {
          maxAbs = abs;
          maxCell = `${grades[gi]} 的 ${departments[di]}（${ratio > 1 ? '+' : '-'}${Math.round(abs * 100)}%）`;
        }
      }
    }
    return maxCell ? `偏离最大的是 ${maxCell}` : '各部门职级组合薪酬均衡';
  })();

  return (
    <ChartCard title="职级 × 部门 薪酬中位对比" finding={finding}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <Dropdown label="显示" value={mode}
          options={[
            { value: 'absolute', label: '绝对值' },
            { value: 'relative', label: '相对整体中位' },
          ]}
          onChange={v => setMode(v as 'absolute' | 'relative')} />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={matrixTh('left', 72)}>职级</th>
              {departments.map(d => (
                <th key={d} style={matrixTh('center')}>{d}</th>
              ))}
              <th style={{ ...matrixTh('center', 110),
                borderLeft: '2px solid #E2E8F0',
                background: '#F8FAFC',
                color: TEXT_PRIMARY, fontWeight: 600 }}>公司整体</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g, gi) => {
              const overall = overall_medians[gi];
              return (
                <tr key={g}>
                  <td style={matrixTd('left', 600)}>{g}</td>
                  {departments.map((_d, di) => {
                    const v = values[gi]?.[di];
                    if (v == null) {
                      return <td key={di} style={matrixTd('center', 400, '#F9FAFB', TEXT_MUTED)}>—</td>;
                    }
                    if (mode === 'absolute') {
                      return <td key={di} style={matrixTd('center', 500)}>{fmtMoney(v)}</td>;
                    }
                    // 相对比例
                    if (!overall) {
                      return <td key={di} style={matrixTd('center', 400, '#F9FAFB', TEXT_MUTED)}>—</td>;
                    }
                    const ratio = v / overall;
                    const { bg, fg } = ratioColor(ratio);
                    const signed = ratio > 1 ? `+${Math.round((ratio - 1) * 100)}%` : `${Math.round((ratio - 1) * 100)}%`;
                    return (
                      <td key={di} style={matrixTd('center', 600, bg, fg)}>
                        {signed}
                      </td>
                    );
                  })}
                  <td style={{
                    ...matrixTd('center', 700),
                    borderLeft: '2px solid #E2E8F0',
                    background: '#F8FAFC',
                  }}>
                    {overall != null ? fmtMoney(overall) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 8 }}>
        {mode === 'absolute'
          ? '单元格 = 该部门在该职级的中位薪酬（绝对数）；最右列 = 不分部门的整体中位'
          : '单元格 = 该部门中位 / 整体中位 - 1（百分比偏离），+ 偏高 / - 偏低'}
      </div>
    </ChartCard>
  );
}

function matrixTh(align: 'left' | 'center' | 'right', width?: number): React.CSSProperties {
  return {
    padding: '8px 10px', textAlign: align,
    color: TEXT_MUTED, fontWeight: 500, fontSize: 11,
    borderBottom: '1px solid #E2E8F0',
    ...(width ? { width } : {}),
  };
}

function matrixTd(align: 'left' | 'center' | 'right',
                  fontWeight: number = 400,
                  bg: string = 'transparent',
                  color: string = TEXT_PRIMARY): React.CSSProperties {
  return {
    padding: '10px', textAlign: align,
    fontWeight, background: bg, color,
    borderBottom: '1px solid #F1F5F9',
  };
}

// =========================================================================
// 视图选择 + 工具栏
// =========================================================================
function pickView(data: any, salaryType: 'base' | 'tcc', scope: string) {
  if (!data?.views) return data; // 老后端：顶层即视图
  if (scope === '__overall__') return data.views.overall?.[salaryType];
  const [kind, name] = scope.split(':');
  if (kind === 'dept') return data.views.by_department?.[name]?.[salaryType];
  if (kind === 'func') return data.views.by_function?.[name]?.[salaryType];
  return data.views.overall?.[salaryType];
}

function ModuleToolbar({ salaryType, onSalaryChange, scope, onScopeChange, departments, functions }: {
  salaryType: 'base' | 'tcc';
  onSalaryChange: (v: 'base' | 'tcc') => void;
  scope: string;
  onScopeChange: (v: string) => void;
  departments: string[];
  functions: string[];
}) {
  // 范围下拉：公司整体 + 各部门 + 各职能
  const scopeOptions = [
    { value: '__overall__', label: '公司整体' },
    ...departments.map(d => ({ value: `dept:${d}`, label: `部门：${d}` })),
    ...functions.map(f => ({ value: `func:${f}`, label: `职能：${f}` })),
  ];
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
      <Dropdown label="薪酬口径" value={salaryType}
        options={[{ value: 'base', label: '年基本工资' }, { value: 'tcc', label: '年度总现金' }]}
        onChange={v => onSalaryChange(v as 'base' | 'tcc')} />
      <Dropdown label="范围" value={scope} options={scopeOptions} onChange={onScopeChange} />
    </div>
  );
}

function Dropdown({ label, value, options, onChange }: {
  label: string; value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = options.find(o => o.value === value)?.label ?? '';
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', borderRadius: 999,
          border: `1px solid ${open ? '#D85A30' : '#e5e7eb'}`,
          background: open ? '#FEF7F4' : '#fff',
          fontSize: 12, color: '#475569', cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(216,90,48,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>{current}</span>
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: '100%', whiteSpace: 'nowrap',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 12px 28px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
          padding: 4, zIndex: 50, maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(o => {
            const sel = o.value === value;
            return (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12,
                  background: sel ? '#FEF2EE' : 'transparent',
                  color: sel ? '#D85A30' : '#475569',
                  fontWeight: sel ? 600 : 400,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                <span>{o.label}</span>
                {sel && <span style={{ fontSize: 10 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 箱线图 Section：精修版本，加完整元素说明
// =========================================================================
interface BoxRaw {
  grade: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  status?: string;
}

interface BoxClipped extends BoxRaw {
  whiskerLow: number;
  whiskerHigh: number;
}

function BoxPlotSection({ boxplot, finding }: { boxplot: BoxRaw[]; finding: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Tukey 1.5×IQR 裁剪：盒子=P25-P75，须线最远到 ±1.5×IQR，超出的标为离群
  const clipped: BoxClipped[] = [];
  const coreVals: number[] = [];
  for (const b of boxplot) {
    const iqr = (b.q3 ?? b.max) - (b.q1 ?? b.min);
    const upperFence = (b.q3 ?? b.max) + 1.5 * iqr;
    const lowerFence = (b.q1 ?? b.min) - 1.5 * iqr;
    const whiskerHigh = Math.min(b.max, upperFence);
    const whiskerLow = Math.max(b.min, lowerFence);
    clipped.push({
      grade: b.grade,
      q1: b.q1 ?? b.min,
      median: b.median ?? (b.min + b.max) / 2,
      q3: b.q3 ?? b.max,
      min: b.min, max: b.max,
      whiskerLow, whiskerHigh,
      status: b.status,
    });
    coreVals.push(whiskerLow, b.q1 ?? b.min, b.median ?? (b.min + b.max) / 2, b.q3 ?? b.max, whiskerHigh);
  }
  const yMax = Math.max(...coreVals) * 1.05;
  const yMin = 0;
  const chartW = 640, chartH = 280;
  const pad = { top: 24, right: 24, bottom: 44, left: 60 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;
  const yScale = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const boxW = Math.min(48, (innerW / clipped.length) * 0.55);
  const xScale = (i: number) => pad.left + (i + 0.5) * (innerW / clipped.length);

  const fmtMoney = (v: number) => v >= 10000
    ? `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}万`
    : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`;

  return (
    <ChartCard title="各层级薪酬分布" finding={finding}>
      <div style={{ position: 'relative' }}>
        <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ overflow: 'visible' }}>
          <defs>
            {/* 盒子柔影 filter */}
            <filter id="box-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.12" />
            </filter>
            {/* hover 时的柔光 */}
            <filter id="box-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y 网格 */}
          {[0, 0.25, 0.5, 0.75, 1].map(r => {
            const y = pad.top + innerH * (1 - r);
            const val = yMin + (yMax - yMin) * r;
            return (
              <g key={r}>
                <line x1={pad.left} x2={chartW - pad.right} y1={y} y2={y}
                  stroke="#eef2f7" strokeDasharray="3 4" />
                <text x={pad.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill={TEXT_MUTED}>
                  {fmtMoney(val)}
                </text>
              </g>
            );
          })}

          {/* 每个职级的箱线 */}
          {clipped.map((c, i) => {
            const isHigh = c.status === 'high';
            const stroke = isHigh ? BOX_HIGH : BOX_NORMAL;
            const fill = isHigh ? BOX_HIGH_FILL : BOX_NORMAL_FILL;
            const cx = xScale(i);
            const isHover = hoverIdx === i;
            const halfW = boxW / 2;
            const capW = halfW * 0.55;

            return (
              <g key={i}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{ cursor: 'default' }}
              >
                {/* 须线（中央细线） */}
                <line x1={cx} x2={cx} y1={yScale(c.whiskerLow)} y2={yScale(c.whiskerHigh)}
                  stroke={stroke} strokeWidth={1.2} opacity={0.8} />
                {/* 须线两端的小帽（短线段，比上下细线宽更窄，更精致） */}
                <line x1={cx - capW} x2={cx + capW} y1={yScale(c.whiskerLow)} y2={yScale(c.whiskerLow)}
                  stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
                <line x1={cx - capW} x2={cx + capW} y1={yScale(c.whiskerHigh)} y2={yScale(c.whiskerHigh)}
                  stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />

                {/* 盒子（P25-P75，直角 + 柔影） */}
                <rect x={cx - halfW} y={yScale(c.q3)}
                  width={boxW} height={Math.max(1, yScale(c.q1) - yScale(c.q3))}
                  fill={fill} stroke={stroke} strokeWidth={1.4}
                  filter={isHover ? 'url(#box-glow)' : 'url(#box-shadow)'}
                  opacity={isHover ? 0.95 : 1}
                  style={{ transition: 'opacity 0.15s' }}
                />
                {/* 中位线（粗一点，强调） */}
                <line x1={cx - halfW + 2} x2={cx + halfW - 2}
                  y1={yScale(c.median)} y2={yScale(c.median)}
                  stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />

                {/* X 轴：职级标签 */}
                <text x={cx} y={chartH - pad.bottom + 18} textAnchor="middle"
                  fontSize={11} fontWeight={isHover ? 700 : isHigh ? 600 : 500}
                  fill={isHover ? TEXT_PRIMARY : TEXT_SUB}
                  style={{ transition: 'all 0.15s' }}>
                  {c.grade}
                </text>
              </g>
            );
          })}
        </svg>

        {/* hover Tooltip */}
        {hoverIdx != null && (() => {
          const c = clipped[hoverIdx];
          const cx = xScale(hoverIdx);
          const leftPct = (cx / chartW) * 100;
          const rightSide = leftPct > 65;
          return (
            <div style={{
              position: 'absolute',
              left: `${leftPct}%`, top: yScale(c.median) - 60,
              transform: rightSide ? 'translate(-110%, 0)' : 'translate(10%, 0)',
              background: '#fff', color: TEXT_PRIMARY,
              border: '1px solid #E2E8F0',
              padding: '10px 14px', borderRadius: 10, fontSize: 12, lineHeight: 1.55,
              pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
              boxShadow: '0 12px 28px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.05)',
              minWidth: 160,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{c.grade}</div>
              <div style={{ color: TEXT_SUB }}>P75：¥{Math.round(c.q3).toLocaleString()}</div>
              <div><strong>中位 P50：¥{Math.round(c.median).toLocaleString()}</strong></div>
              <div style={{ color: TEXT_SUB }}>P25：¥{Math.round(c.q1).toLocaleString()}</div>
              <div style={{ marginTop: 4, color: TEXT_SUB, fontSize: 11 }}>
                整体：¥{c.min.toLocaleString()} ~ ¥{c.max.toLocaleString()}
              </div>
            </div>
          );
        })()}
      </div>

      {/* 元素图例（关键，让用户看懂） */}
      <BoxLegend />

      {/* 各职级薪酬区间清单 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12,
        paddingTop: 12, borderTop: '1px dashed #E2E8F0',
      }}>
        {boxplot.map((b: BoxRaw) => (
          <div key={b.grade} style={{ fontSize: 11, color: TEXT_SUB }}>
            <span style={{ fontWeight: 600, color: TEXT_PRIMARY }}>{b.grade}</span>
            <span style={{ marginLeft: 6, color: TEXT_MUTED }}>
              ¥{b.min.toLocaleString()} ~ ¥{b.max.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

// 箱线图元素图例：每个元素配一个迷你 SVG 图标 + 文字说明
function BoxLegend() {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 18,
      marginTop: 16, padding: '10px 14px',
      background: '#F8FAFC', borderRadius: 8,
      fontSize: 11, color: TEXT_SUB,
    }}>
      <LegendItem icon={<BoxIcon />} label={<span><strong style={{ color: TEXT_PRIMARY }}>盒子</strong> = 中间 50% 员工 (P25-P75)</span>} />
      <LegendItem icon={<MedianIcon />} label={<span><strong style={{ color: TEXT_PRIMARY }}>粗线</strong> = 中位数 P50</span>} />
      <LegendItem icon={<WhiskerIcon />} label={<span><strong style={{ color: TEXT_PRIMARY }}>上下细线</strong> = 主体数据范围</span>} />
    </div>
  );
}

function LegendItem({ icon, label }: { icon: React.ReactNode; label: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

// 迷你图标：跟图表里的元素同色（用品牌橙做演示色，实际图里两种状态色都用）
function BoxIcon() {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <rect x="2" y="3" width="16" height="8" fill={BOX_NORMAL_FILL} stroke={BOX_NORMAL} strokeWidth={1.4} />
      <line x1="4" x2="16" y1="7" y2="7" stroke={BOX_NORMAL} strokeWidth={1.6} />
    </svg>
  );
}
function MedianIcon() {
  return (
    <svg width={20} height={14} viewBox="0 0 20 14">
      <line x1="2" x2="18" y1="7" y2="7" stroke={BOX_NORMAL} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}
function WhiskerIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14">
      <line x1="7" x2="7" y1="2" y2="12" stroke={BOX_NORMAL} strokeWidth={1.2} />
      <line x1="4" x2="10" y1="2" y2="2" stroke={BOX_NORMAL} strokeWidth={1.5} strokeLinecap="round" />
      <line x1="4" x2="10" y1="12" y2="12" stroke={BOX_NORMAL} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
