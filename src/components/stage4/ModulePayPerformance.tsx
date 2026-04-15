import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

const PERF_COLORS: Record<string, string> = {
  'A': '#22C55E', 'B+': '#3B82F6', 'B': '#64748B', 'B-': '#F59E0B', 'C': '#EF4444',
};

export default function ModulePayPerformance({ data, insight }: { data: any; insight?: string }) {
  const perfStats = data?.perf_stats || [];
  const tccByPerf = data?.tcc_by_perf || [];
  const aVsCRatio = data?.a_vs_c_ratio;
  const aVsBGap = data?.a_vs_b_gap_pct;
  const spreadAdequate = data?.spread_adequate;

  if (!data?.has_data) {
    return (
      <ModuleShell title="绩效关联分析" subtitle="缺少绩效数据，此模块不可用">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          需要在数据中提供员工绩效等级才能分析
        </div>
      </ModuleShell>
    );
  }

  return (
    <ModuleShell
      title="绩效关联分析"
      subtitle="不同绩效等级间的薪酬差异"
      metrics={[
        {
          label: 'A/B 薪酬差距',
          value: aVsBGap != null ? `${aVsBGap}%` : '—',
          color: spreadAdequate === false ? '#DC2626' : 'var(--green)',
          sub: spreadAdequate === false ? '⚠ 区分度不足' : '区分度合理',
        },
        {
          label: 'A/C 薪酬倍数',
          value: aVsCRatio ?? '—',
          sub: '高绩效 vs 低绩效',
        },
      ]}
      insight={insight}
    >
      {tccByPerf.length > 0 && (
        <ChartCard title="各绩效等级平均年度总现金">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={tccByPerf}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '平均TCC']} />
              <Bar dataKey="avg_tcc" radius={[4, 4, 0, 0]}>
                {tccByPerf.map((entry: any, i: number) => (
                  <Cell key={i} fill={PERF_COLORS[entry.grade] || '#64748B'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {perfStats.length > 0 && (
        <ChartCard title="各绩效等级薪酬明细">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>绩效等级</th>
                <th style={{ textAlign: 'center', padding: 8 }}>人数</th>
                <th style={{ textAlign: 'center', padding: 8 }}>平均月薪</th>
                <th style={{ textAlign: 'center', padding: 8 }}>平均 CR</th>
              </tr>
            </thead>
            <tbody>
              {perfStats.map((p: any) => (
                <tr key={p.grade} style={{ borderBottom: '1px solid #f5f5f5' }}>
                  <td style={{ padding: 8, fontWeight: 600, color: PERF_COLORS[p.grade] || '#64748B' }}>{p.grade}</td>
                  <td style={{ textAlign: 'center', padding: 8 }}>{p.count}</td>
                  <td style={{ textAlign: 'center', padding: 8 }}>¥{p.avg_salary?.toLocaleString()}</td>
                  <td style={{ textAlign: 'center', padding: 8 }}>{p.avg_cr ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
      )}
    </ModuleShell>
  );
}
