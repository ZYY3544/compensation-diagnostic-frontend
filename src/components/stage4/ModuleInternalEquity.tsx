import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleInternalEquity({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const dispersion = data?.dispersion || [];
  const boxplot = data?.boxplot || [];
  const deviation = data?.deviation_matrix || { departments: [], grades: [], values: [] };
  const highCount = data?.high_dispersion_count || 0;
  const totalGrades = dispersion.length;

  const subtitleParts: string[] = [];
  subtitleParts.push(`共 ${totalGrades} 个层级`);
  if (highCount > 0) subtitleParts.push(`${highCount} 个离散度偏高`);
  else subtitleParts.push('整体离散度正常');
  const subtitle = subtitleParts.join(' · ');

  // Boxplot 发现：极差比最大的层级（max/min）
  let boxFinding = '';
  if (boxplot.length > 0) {
    const withRange = boxplot
      .filter((b: any) => b.min > 0)
      .map((b: any) => ({ ...b, rangeRatio: b.max / b.min }));
    if (withRange.length > 0) {
      const sorted = [...withRange].sort((a, b) => b.rangeRatio - a.rangeRatio);
      const top = sorted[0];
      boxFinding = `${top.grade} 层级薪酬分布最分散（最高/最低 ${top.rangeRatio.toFixed(1)} 倍）`;
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

  // 偏离度矩阵发现：偏离度 > 15% 的单元格数量
  let devFinding = '';
  if (deviation.values?.length > 0) {
    let severe = 0, moderate = 0;
    for (const row of deviation.values) {
      for (const v of row) {
        if (v == null) continue;
        if (Math.abs(v) > 15) severe++;
        else if (Math.abs(v) > 8) moderate++;
      }
    }
    const parts: string[] = [];
    if (severe) parts.push(`${severe} 格偏离严重（>15%）`);
    if (moderate) parts.push(`${moderate} 格偏离中等（8-15%）`);
    devFinding = parts.length > 0 ? parts.join('，') : '各部门职级组合薪酬均衡';
  }

  return (
    <ModuleShell
      title="内部公平性分析"
      subtitle={subtitle}
      insight={insight}
      insightLoading={insightLoading}
    >
      {boxplot.length > 0 && (() => {
        // 按 IQR × 1.5 裁剪，避免一个 300k 的异常值把 Y 轴撑爆
        const clipped: Array<{ grade: string; whiskerLow: number; whiskerHigh: number; q1: number; median: number; q3: number; min: number; max: number; outlierHigh: number | null; outlierLow: number | null; status?: string }> = [];
        const coreVals: number[] = [];
        for (const b of boxplot) {
          const iqr = (b.q3 ?? b.max) - (b.q1 ?? b.min);
          const upperFence = (b.q3 ?? b.max) + 1.5 * iqr;
          const lowerFence = (b.q1 ?? b.min) - 1.5 * iqr;
          const whiskerHigh = Math.min(b.max, upperFence);
          const whiskerLow = Math.max(b.min, lowerFence);
          clipped.push({
            grade: b.grade, q1: b.q1 ?? b.min, median: b.median ?? (b.min + b.max) / 2, q3: b.q3 ?? b.max,
            min: b.min, max: b.max, whiskerLow, whiskerHigh,
            outlierHigh: b.max > upperFence ? b.max : null,
            outlierLow: b.min < lowerFence ? b.min : null,
            status: b.status,
          });
          coreVals.push(whiskerLow, b.q1 ?? b.min, b.median ?? (b.min + b.max) / 2, b.q3 ?? b.max, whiskerHigh);
        }
        const yMax = Math.max(...coreVals) * 1.05;
        const yMin = 0;
        const chartW = 640, chartH = 260;
        const pad = { top: 20, right: 20, bottom: 40, left: 60 };
        const innerW = chartW - pad.left - pad.right;
        const innerH = chartH - pad.top - pad.bottom;
        const yScale = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
        const boxW = Math.min(42, (innerW / clipped.length) * 0.55);
        const xScale = (i: number) => pad.left + (i + 0.5) * (innerW / clipped.length);
        const hasOutliers = clipped.some(c => c.outlierHigh != null || c.outlierLow != null);

        return (
          <ChartCard title="各层级薪酬分布" finding={boxFinding}>
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`}>
              {[0, 0.25, 0.5, 0.75, 1].map(r => {
                const y = pad.top + innerH * (1 - r);
                const val = yMin + (yMax - yMin) * r;
                return (
                  <g key={r}>
                    <line x1={pad.left} x2={chartW - pad.right} y1={y} y2={y} stroke="#f0f0f4" strokeDasharray="3 3" />
                    <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#a0a0b0">
                      {val >= 10000 ? `${(val / 10000).toFixed(val >= 100000 ? 0 : 1)}万` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
                    </text>
                  </g>
                );
              })}
              {clipped.map((c, i) => {
                const isHigh = c.status === 'high';
                const color = isHigh ? '#DC2626' : '#3B82F6';
                const cx = xScale(i);
                return (
                  <g key={i}>
                    <line x1={cx} x2={cx} y1={yScale(c.whiskerLow)} y2={yScale(c.whiskerHigh)} stroke={color} />
                    <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(c.whiskerLow)} y2={yScale(c.whiskerLow)} stroke={color} />
                    <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(c.whiskerHigh)} y2={yScale(c.whiskerHigh)} stroke={color} />
                    <rect x={cx - boxW / 2} y={yScale(c.q3)} width={boxW} height={Math.max(1, yScale(c.q1) - yScale(c.q3))}
                      fill={isHigh ? '#FEE2E2' : '#DBEAFE'} stroke={color} />
                    <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yScale(c.median)} y2={yScale(c.median)} stroke={color} strokeWidth={2} />
                    {c.outlierHigh != null && (
                      <polygon points={`${cx - 5},${pad.top + 2} ${cx + 5},${pad.top + 2} ${cx},${pad.top + 9}`} fill={color}>
                        <title>{`离群高值: ¥${c.outlierHigh.toLocaleString()}`}</title>
                      </polygon>
                    )}
                    {c.outlierLow != null && (
                      <circle cx={cx} cy={yScale(c.whiskerLow) + 10} r={3} fill="#fff" stroke={color}>
                        <title>{`离群低值: ¥${c.outlierLow.toLocaleString()}`}</title>
                      </circle>
                    )}
                    <text x={cx} y={chartH - pad.bottom + 18} textAnchor="middle" fontSize={11} fill="#6b6b7e" fontWeight={isHigh ? 500 : 400}>
                      {c.grade}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
              {boxplot.map((b: any) => (
                <div key={b.grade} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {b.grade}: ¥{b.min.toLocaleString()} ~ ¥{b.max.toLocaleString()}
                </div>
              ))}
            </div>
            {hasOutliers && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>▼ 表示超出主体数据范围的离群值（&gt; P75 + 1.5×IQR）</div>
            )}
          </ChartCard>
        );
      })()}

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

      {deviation.departments.length > 0 && (
        <ChartCard title="部门 × 职级 薪酬偏离度" finding={devFinding}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>部门</th>
                  {deviation.grades.map((g: string) => (
                    <th key={g} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deviation.departments.map((dept: string, di: number) => (
                  <tr key={dept}>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{dept}</td>
                    {(deviation.values[di] || []).map((val: number | null, gi: number) => {
                      const bg = val == null ? '#F9FAFB'
                        : Math.abs(val) > 15 ? '#FEE2E2'
                        : Math.abs(val) > 8 ? '#FEF3C7'
                        : '#D1FAE5';
                      return (
                        <td key={gi} style={{ padding: '8px', textAlign: 'center', background: bg, fontWeight: 500 }}>
                          {val != null ? `${val > 0 ? '+' : ''}${val}%` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </ModuleShell>
  );
}
