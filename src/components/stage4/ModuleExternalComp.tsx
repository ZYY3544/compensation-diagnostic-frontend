import { useState, type CSSProperties } from 'react';
import ModuleShell, { ChartCard } from './ModuleShell';
import GradeTrendChart from './GradeTrendChart';

export default function ModuleExternalComp({ data, insight, insightLoading, gradeTrendTcc, gradeTrendBase }: {
  data: any; insight?: string; insightLoading?: boolean; gradeTrendTcc?: any; gradeTrendBase?: any;
}) {
  // 热力图悬停高亮：记当前 hover 的 (行, 列) 索引；同行行标题、同列列头一起加粗，单元格自身描边
  const [hoverCell, setHoverCell] = useState<{ di: number; gi: number } | null>(null);

  const heatmap = data?.cr_heatmap || { departments: [], grades: [], values: [] };
  const overallCR = data?.overall_cr;
  const belowP25 = data?.total_below_p25 || 0;
  const aboveP75 = data?.total_above_p75 ?? null;
  const deviationTop = data?.deviation_top || [];
  const deviationSummary = data?.summary_text || '';

  // 副标题关键指标概要
  const subtitleParts: string[] = [];
  if (overallCR != null) subtitleParts.push(`整体 CR ${overallCR}`);
  subtitleParts.push(`${belowP25} 人低于 P25`);
  if (aboveP75 != null) subtitleParts.push(`${aboveP75} 人高于 P75`);
  const subtitle = subtitleParts.join(' · ');

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
      {/* 核心图表：职级薪酬趋势图 */}
      {gradeTrendTcc?.grades?.length > 0 && gradeTrendBase?.grades?.length > 0 && (
        <ChartCard title="职级薪酬趋势">
          <GradeTrendChart tccData={gradeTrendTcc} baseData={gradeTrendBase} />
        </ChartCard>
      )}

      {heatmap.departments.length > 0 && heatmap.grades.length > 0 && (
        <ChartCard title="部门 × 职级 CR 热力图" finding={heatFinding}>
          <div style={{ overflowX: 'auto' }} onMouseLeave={() => setHoverCell(null)}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>部门</th>
                  {heatmap.grades.map((g: string, gi: number) => {
                    const isCol = hoverCell?.gi === gi;
                    return (
                      <th key={g} style={{
                        padding: '6px 8px', textAlign: 'center',
                        color: isCol ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontWeight: isCol ? 700 : 500,
                        transition: 'color 0.12s, font-weight 0.12s',
                      }}>{g}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {heatmap.departments.map((dept: string, di: number) => {
                  const isRow = hoverCell?.di === di;
                  return (
                    <tr key={dept}>
                      <td style={{
                        padding: '8px',
                        fontWeight: isRow ? 700 : 500,
                        color: isRow ? 'var(--text-primary)' : undefined,
                        transition: 'color 0.12s, font-weight 0.12s',
                      }}>{dept}</td>
                      {(heatmap.values[di] || []).map((cr: number | null, gi: number) => {
                        let bg = '#F9FAFB', color = 'inherit', fontWeight: number | string = 500;
                        if (cr != null) {
                          if (cr < 0.85) { bg = '#FEE2E2'; color = '#991B1B'; }
                          else if (cr <= 1.15) { bg = '#D1FAE5'; color = '#065F46'; }
                          else if (cr <= 2.0) { bg = '#FEF3C7'; color = '#92400E'; }
                          else { bg = '#FCA5A5'; color = '#7F1D1D'; fontWeight = 700; }
                        }
                        const count = heatmap.counts?.[di]?.[gi] ?? 0;
                        const grade = heatmap.grades[gi];
                        const tip = cr != null
                          ? `${dept} · ${grade}\n${count} 人 · CR ${cr.toFixed(2)}`
                          : `${dept} · ${grade}\n暂无数据`;
                        const isHover = hoverCell?.di === di && hoverCell?.gi === gi;
                        return (
                          <td key={gi} title={tip}
                            onMouseEnter={() => setHoverCell({ di, gi })}
                            style={{
                              padding: '8px', textAlign: 'center', background: bg, color, fontWeight,
                              cursor: 'default',
                              // hover：内描边（用 inset shadow，避免影响表格 layout）+ 外发光
                              boxShadow: isHover
                                ? 'inset 0 0 0 2px #1F2937, 0 2px 8px rgba(31,41,55,0.18)'
                                : undefined,
                              position: isHover ? 'relative' : undefined,
                              zIndex: isHover ? 1 : undefined,
                              transition: 'box-shadow 0.12s',
                            }}>
                            {cr != null ? cr.toFixed(2) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}

      {deviationTop.length > 0 && (
        <ChartCard title="偏离市场最大的员工（前 10%）" finding={deviationSummary}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border, #E5E7EB)' }}>
                  <th style={devTh('56px', 'center')}>排名</th>
                  <th style={devTh('100px', 'left')}>员工 ID</th>
                  <th style={devTh('110px', 'left')}>部门</th>
                  <th style={devTh(undefined, 'left')}>岗位 / 职级</th>
                  <th style={devTh('110px', 'right')}>个人薪酬</th>
                  <th style={devTh('100px', 'right')}>市场 P50</th>
                  <th style={devTh('150px', 'right')}>vs 市场 P50 偏离度</th>
                </tr>
              </thead>
              <tbody>
                {deviationTop.map((row: any) => {
                  const devStyle = severityColor(row.deviation_pct);
                  const arrow = row.deviation_pct < 0 ? '↓' : row.deviation_pct > 0 ? '↑' : '';
                  const sign = row.deviation_pct > 0 ? '+' : '';
                  return (
                    <tr key={row.rank} style={{ height: 40, borderBottom: '1px solid var(--border, #F3F4F6)' }}>
                      <td style={devTd('center', 600)}>{row.rank}</td>
                      <td style={devTd('left')}>{row.id || '—'}</td>
                      <td style={devTd('left')}>{row.department || '—'}</td>
                      <td style={devTd('left', 500)}>{[row.job_title, row.grade].filter(Boolean).join(' / ') || '—'}</td>
                      <td style={devTd('right')}>{Number(row.base_monthly).toLocaleString()}</td>
                      <td style={devTd('right')}>{Number(row.market_p50).toLocaleString()}</td>
                      <td style={devTd('right')}>
                        <span style={{
                          display: 'inline-block', padding: '4px 10px', borderRadius: 4,
                          background: devStyle.bg, color: devStyle.color, fontWeight: 600, fontSize: 12,
                        }}>
                          {sign}{row.deviation_pct}% {arrow}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </ModuleShell>
  );
}

function devTh(width: string | undefined, align: 'left' | 'right' | 'center'): CSSProperties {
  return {
    padding: '10px 12px', textAlign: align, color: 'var(--text-muted, #6B7280)',
    fontWeight: 500, fontSize: 12, ...(width ? { width } : {}),
  };
}

function devTd(align: 'left' | 'right' | 'center', fontWeight: number = 400): CSSProperties {
  return { padding: '0 12px', textAlign: align, fontWeight };
}

// 颜色按"偏离绝对幅度"分档（不分方向）；方向用 ↑↓ 箭头另外表达。
// 这张表本身就是"偏离最大的前 10%"，每一行都是值得关注的，不出现绿色"OK"。
function severityColor(pct: number): { bg: string; color: string } {
  const abs = Math.abs(pct);
  if (abs >= 30) return { bg: '#FEE2E2', color: '#991B1B' };   // 深红：≥30%
  if (abs >= 15) return { bg: '#FED7AA', color: '#9A3412' };   // 橙：15-30%
  return { bg: '#FEF3C7', color: '#92400E' };                  // 黄：<15%
}
