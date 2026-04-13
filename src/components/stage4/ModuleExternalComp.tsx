import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';

export default function ModuleExternalComp({ data }: { data: any }) {
  const crByFunc = data?.cr_by_function || [];
  const heatmap = data?.cr_heatmap || { departments: [], grades: [], values: [] };
  const overallCR = data?.overall_cr;
  const belowP25 = data?.total_below_p25 || 0;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>外部竞争力分析</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        员工薪酬与市场水平对比 · 整体 CR {overallCR ?? '—'} · {belowP25} 人低于 P25
      </div>

      {/* CR by Function 柱状图 */}
      {crByFunc.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各职能 Compa-Ratio</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={crByFunc} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 'auto']} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [Number(v).toFixed(2), 'CR']} />
              <ReferenceLine x={1} stroke="#666" strokeDasharray="3 3" label="P50" />
              <Bar dataKey="cr" radius={[0, 4, 4, 0]}>
                {crByFunc.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.cr < 0.9 ? '#EF4444' : entry.cr < 1.0 ? '#F59E0B' : '#22C55E'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* CR 热力图 */}
      {heatmap.departments.length > 0 && heatmap.grades.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>部门 × 职级 CR 热力图</div>
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
                      const bg = cr == null ? '#F9FAFB'
                        : cr < 0.85 ? '#FEE2E2'
                        : cr < 0.95 ? '#FEF3C7'
                        : cr < 1.05 ? '#D1FAE5'
                        : '#DBEAFE';
                      return (
                        <td key={gi} style={{ padding: '8px', textAlign: 'center', background: bg, fontWeight: 500 }}>
                          {cr != null ? cr.toFixed(2) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
