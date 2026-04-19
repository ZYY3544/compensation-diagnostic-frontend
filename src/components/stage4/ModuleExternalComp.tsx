import { useState, type CSSProperties } from 'react';
import ModuleShell, { ChartCard } from './ModuleShell';
import GradeTrendChart from './GradeTrendChart';

export default function ModuleExternalComp({ data, insight, insightLoading, gradeTrendTcc, gradeTrendBase }: {
  data: any; insight?: string; insightLoading?: boolean; gradeTrendTcc?: any; gradeTrendBase?: any;
}) {
  // 热力图悬停高亮：记当前 hover 的 (行, 列) 索引；同行行标题、同列列头一起加粗，单元格自身描边
  const [hoverCell, setHoverCell] = useState<{ di: number; gi: number } | null>(null);

  const heatmap = data?.cr_heatmap || { rows: [], grades: [], values: [], counts: [], row_label: '行' };
  // 兼容旧后端：还在用 departments 时自动映射成 rows
  const heatmapRows: string[] = heatmap.rows || heatmap.functions || heatmap.departments || [];
  const heatmapRowLabel: string = heatmap.row_label || '部门';
  const overallCR = data?.overall_cr;
  const summary = data?.summary || {};
  const avgPercentile: number | null = summary.avg_percentile ?? null;
  const totalHeadcount: number = summary.total_headcount || 0;
  const segmentDistribution: Array<{key: string; label: string; count: number; pct: number}> =
    summary.segment_distribution || [];
  const deviationTop = data?.deviation_top || [];
  const deviationSummary = data?.summary_text || '';

  // 副标题保持简洁：副标题位置已经被顶部 KPI 总览块取代，这里给个一句话定位
  const subtitle = `共 ${totalHeadcount} 人参与对标 · 详细分布见下方`;

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
      {/* 顶部 KPI 总览块：整体 CR / 整体分位 / 四段人数分布 */}
      {totalHeadcount > 0 && (
        <OverviewKpis
          overallCR={overallCR}
          avgPercentile={avgPercentile}
          totalHeadcount={totalHeadcount}
          segments={segmentDistribution}
        />
      )}

      {/* 职级薪酬趋势：上下两张图（GradeTrendChart 内部各自包了 ChartCard） */}
      {(gradeTrendTcc?.overall?.grades?.length > 0 || gradeTrendTcc?.grades?.length > 0) && (
        <GradeTrendChart tccData={gradeTrendTcc} baseData={gradeTrendBase} />
      )}

      {heatmapRows.length > 0 && heatmap.grades.length > 0 && (
        <ChartCard title={`${heatmapRowLabel} × 职级 CR 热力图`} finding={heatFinding}>
          <div style={{ overflowX: 'auto' }} onMouseLeave={() => setHoverCell(null)}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: 'var(--text-muted)' }}>{heatmapRowLabel}</th>
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
                {heatmapRows.map((rowLabel: string, di: number) => {
                  const isRow = hoverCell?.di === di;
                  return (
                    <tr key={rowLabel}>
                      <td style={{
                        padding: '8px',
                        fontWeight: isRow ? 700 : 500,
                        color: isRow ? 'var(--text-primary)' : undefined,
                        transition: 'color 0.12s, font-weight 0.12s',
                      }}>{rowLabel}</td>
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
                          ? `${rowLabel} · ${grade}\n${count} 人 · CR ${cr.toFixed(2)}`
                          : `${rowLabel} · ${grade}\n暂无数据`;
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
                  <th style={devTh('90px', 'left')}>工号</th>
                  <th style={devTh(undefined, 'left')}>岗位</th>
                  <th style={devTh('64px', 'center')}>职级</th>
                  <th style={devTh('110px', 'left')}>一级部门</th>
                  <th style={devTh('120px', 'right')}>所在级别公司 P50</th>
                  <th style={devTh('120px', 'right')}>所在级别市场 P50</th>
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
                      <td style={devTd('left', 500)}>{row.job_title || '—'}</td>
                      <td style={devTd('center')}>{row.grade || '—'}</td>
                      <td style={devTd('left')}>{row.department || '—'}</td>
                      <td style={devTd('right')}>
                        {row.company_grade_p50 ? Number(row.company_grade_p50).toLocaleString() : '—'}
                      </td>
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

// =========================================================================
// 顶部 KPI 总览块：6 张小卡 —— 整体 CR、整体分位、四段人数分布
// =========================================================================
function OverviewKpis({ overallCR, avgPercentile, totalHeadcount, segments }: {
  overallCR?: number | null;
  avgPercentile?: number | null;
  totalHeadcount: number;
  segments: Array<{ key: string; label: string; count: number; pct: number }>;
}) {
  // CR 颜色：<0.85 红 / 0.85-1.15 绿 / 1.15-2.0 橙 / >2.0 深红
  const crColor = (cr: number) => {
    if (cr < 0.85) return '#991B1B';
    if (cr <= 1.15) return '#065F46';
    if (cr <= 2.0) return '#92400E';
    return '#7F1D1D';
  };
  // 分位段颜色：低分位红，高分位绿
  const segColor: Record<string, string> = {
    below_p25: '#991B1B',
    p25_p50: '#92400E',
    p50_p75: '#065F46',
    above_p75: '#1E40AF',
  };
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(6, 1fr)',
      gap: 12,
      marginBottom: 4,
    }}>
      <KpiCard label="整体 CR" value={overallCR != null ? overallCR.toFixed(2) : '—'}
        color={overallCR != null ? crColor(overallCR) : undefined}
        hint={`${totalHeadcount} 人参与对标`} />
      <KpiCard label="整体市场分位" value={avgPercentile != null ? `P${avgPercentile}` : '—'}
        hint="所有员工分位算术平均" />
      {segments.map(seg => (
        <KpiCard key={seg.key} label={seg.label}
          value={`${seg.count} 人`}
          color={segColor[seg.key]}
          hint={`${seg.pct}%`} />
      ))}
    </div>
  );
}

function KpiCard({ label, value, color, hint }: {
  label: string; value: string; color?: string; hint?: string;
}) {
  const accent = color || '#94A3B8';
  return (
    <div style={{
      position: 'relative',
      background: '#fff',
      border: '1px solid #eef0f3',
      borderRadius: 10,
      padding: '14px 16px 12px',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
      overflow: 'hidden',
    }}>
      {/* 顶部细色条作为视觉锚 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: accent, opacity: 0.85,
      }} />
      <div style={{
        fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontWeight: 500,
        letterSpacing: '0.02em', marginTop: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 24, fontWeight: 700,
        color: color || 'var(--text-primary)',
        lineHeight: 1, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {hint}
        </div>
      )}
    </div>
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
