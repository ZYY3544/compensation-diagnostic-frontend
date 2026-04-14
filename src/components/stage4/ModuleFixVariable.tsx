import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ModuleFixVariable({ data, insight }: { data: any; insight?: string }) {
  const byGrade = data?.pay_mix_by_grade || [];
  const byDept = data?.pay_mix_by_dept || [];
  const overallFix = data?.overall_fix_pct;
  const overallVar = data?.overall_var_pct;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>薪酬结构分析</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        固定 vs 浮动薪酬比例 · 整体固浮比 {overallFix ?? '—'}:{overallVar ?? '—'}
      </div>
      {insight && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {insight}
        </div>
      )}

      {/* 按职级的堆叠柱状图 */}
      {byGrade.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各职级固浮比</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byGrade}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']} />
              <Legend />
              <Bar dataKey="fixed" name="固定薪酬" stackId="a" fill="#3B82F6" />
              <Bar dataKey="variable" name="浮动薪酬" stackId="a" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* 百分比明细 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
            {byGrade.map((g: any) => (
              <div key={g.grade} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {g.grade}: {g.fix_pct}:{g.var_pct} ({g.count}人)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 按部门的堆叠柱状图 */}
      {byDept.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>各部门固浮比</div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byDept} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}万`} />
              <YAxis type="category" dataKey="department" width={80} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '']} />
              <Legend />
              <Bar dataKey="fixed" name="固定" stackId="a" fill="#3B82F6" />
              <Bar dataKey="variable" name="浮动" stackId="a" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
