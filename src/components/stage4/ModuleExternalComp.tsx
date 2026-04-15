import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleExternalComp({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const crByFunc = data?.cr_by_function || [];
  const heatmap = data?.cr_heatmap || { departments: [], grades: [], values: [] };
  const overallCR = data?.overall_cr;
  const belowP25 = data?.total_below_p25 || 0;
  const aboveP75 = data?.total_above_p75 ?? null;

  // 副标题关键指标概要
  const subtitleParts: string[] = [];
  if (overallCR != null) subtitleParts.push(`整体 CR ${overallCR}`);
  subtitleParts.push(`${belowP25} 人低于 P25`);
  if (aboveP75 != null) subtitleParts.push(`${aboveP75} 人高于 P75`);
  const subtitle = subtitleParts.join(' · ');

  // 图表发现：代码生成，从 crByFunc 里挑最高 / 最低
  let crFinding = '';
  if (crByFunc.length > 0) {
    const withCR = crByFunc.filter((f: any) => f.cr != null);
    if (withCR.length > 0) {
      const sorted = [...withCR].sort((a, b) => b.cr - a.cr);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      crFinding = `CR 最高的是${top.name}（${Number(top.cr).toFixed(2)}），最低的是${bottom.name}（${Number(bottom.cr).toFixed(2)}）`;
    }
  }

  // 热力图发现：统计偏离单元格
  let heatFinding = '';
  if (heatmap.values?.length > 0) {
    let lowCells = 0, highCells = 0, extremeCells = 0;
    for (const row of heatmap.values) {
      for (const cr of row) {
        if (cr == null) continue;
        if (cr < 0.85) lowCells++;
        else if (cr > 2.0) extremeCells++;
        else if (cr > 1.15) highCells++;
      }
    }
    const parts: string[] = [];
    if (lowCells) parts.push(`${lowCells} 格低于 P25`);
    if (highCells) parts.push(`${highCells} 格高于 P75`);
    if (extremeCells) parts.push(`${extremeCells} 格偏离严重（CR>2.0）`);
    heatFinding = parts.length > 0 ? parts.join('，') : '所有部门职级组合都在市场合理区间内';
  }

  return (
    <ModuleShell
      title="外部竞争力分析"
      subtitle={subtitle}
      insight={insight}
      insightLoading={insightLoading}
    >
      {crByFunc.length > 0 && (
        <ChartCard title="各职能 Compa-Ratio" finding={crFinding}>
          {/* 顶部 margin 留 24px 给 P50 标签，避免被柱子遮 */}
          <ResponsiveContainer width="100%" height={270}>
            <BarChart data={crByFunc} layout="vertical" margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 'auto']} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'CR']} />
              <ReferenceLine
                x={1}
                stroke="#666"
                strokeDasharray="3 3"
                label={{ value: '市场 P50', position: 'top', fill: '#666', fontSize: 11, fontWeight: 600 }}
              />
              <Bar dataKey="cr" radius={[0, 4, 4, 0]}>
                {crByFunc.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.cr < 0.9 ? '#EF4444' : entry.cr < 1.0 ? '#F59E0B' : '#22C55E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {heatmap.departments.length > 0 && heatmap.grades.length > 0 && (
        <ChartCard title="部门 × 职级 CR 热力图" finding={heatFinding}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>部门</th>
                  {heatmap.grades.map((g: string) => (
                    <th key={g} style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)' }}>{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.departments.map((dept: string, di: number) => (
                  <tr key={dept}>
                    <td style={{ padding: '8px', fontWeight: 500 }}>{dept}</td>
                    {(heatmap.values[di] || []).map((cr: number | null, gi: number) => {
                      let bg = '#F9FAFB', color = 'inherit', fontWeight: number | string = 500;
                      if (cr != null) {
                        if (cr < 0.85) { bg = '#FEE2E2'; color = '#991B1B'; }
                        else if (cr <= 1.15) { bg = '#D1FAE5'; color = '#065F46'; }
                        else if (cr <= 2.0) { bg = '#FEF3C7'; color = '#92400E'; }
                        else { bg = '#FCA5A5'; color = '#7F1D1D'; fontWeight = 700; }
                      }
                      return (
                        <td key={gi} style={{ padding: '8px', textAlign: 'center', background: bg, color, fontWeight }}>
                          {cr != null ? cr.toFixed(2) : '—'}
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
