import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ModuleInternalEquity({ data }: { data: any }) {
  const dispersion = data?.dispersion || [];
  const boxplot = data?.boxplot || [];
  const deviation = data?.deviation_matrix || { departments: [], grades: [], values: [] };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>内部公平性分析</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        同职级内薪酬分布 · {data?.high_dispersion_count || 0} 个层级离散度偏高
      </div>

      {/* 各层级薪酬分布（箱线图用柱状图模拟：min-max range + median） */}
      {boxplot.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各层级薪酬分布</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={boxplot}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']} />
              <Bar dataKey="median" fill="#3B82F6" radius={[4, 4, 0, 0]} name="中位数" />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {boxplot.map((b: any) => (
              <div key={b.grade} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {b.grade}: ¥{b.min.toLocaleString()} ~ ¥{b.max.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 离散度表格 */}
      {dispersion.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各层级离散度</div>
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
        </div>
      )}

      {/* 偏离度矩阵 */}
      {deviation.departments.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>部门 × 职级 薪酬偏离度</div>
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
        </div>
      )}
    </div>
  );
}
