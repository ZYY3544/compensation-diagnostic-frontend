import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
      <div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>绩效关联分析</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          缺少绩效数据，此模块不可用
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>绩效关联分析</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        不同绩效等级间的薪酬差异 · A/B 差距 {aVsBGap != null ? `${aVsBGap}%` : '—'}
        {spreadAdequate === false && ' · ⚠ 激励区分度不足'}
      </div>

      {insight && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {insight}
        </div>
      )}

      {/* KPI 卡片 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{aVsCRatio ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>A/C 薪酬倍数</div>
        </div>
        <div style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: spreadAdequate === false ? '#DC2626' : 'var(--green)' }}>
            {aVsBGap != null ? `${aVsBGap}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>A/B 薪酬差距</div>
        </div>
      </div>

      {/* 绩效等级 vs 平均 TCC 柱状图 */}
      {tccByPerf.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各绩效等级平均年度总现金</div>
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
        </div>
      )}

      {/* 绩效统计表 */}
      {perfStats.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各绩效等级薪酬明细</div>
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
        </div>
      )}
    </div>
  );
}
