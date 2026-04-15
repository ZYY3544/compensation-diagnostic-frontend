import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleFixVariable({ data, insight }: { data: any; insight?: string }) {
  const byGrade = data?.pay_mix_by_grade || [];
  const byDept = data?.pay_mix_by_dept || [];
  const overallFix = data?.overall_fix_pct;
  const overallVar = data?.overall_var_pct;

  // 60-80% 固薪比例视为健康区间
  const fixHealthy = overallFix != null && overallFix >= 60 && overallFix <= 80;
  const fixColor = overallFix == null ? undefined
    : !fixHealthy ? '#D97706'
    : 'var(--green)';

  return (
    <ModuleShell
      title="薪酬结构分析"
      subtitle="固定薪酬 vs 浮动薪酬比例"
      metrics={[
        {
          label: '整体固薪占比',
          value: overallFix != null ? `${overallFix}%` : '—',
          color: fixColor,
          sub: fixHealthy ? '健康区间' : overallFix != null ? '偏离 60-80% 健康区间' : undefined,
        },
        {
          label: '整体浮薪占比',
          value: overallVar != null ? `${overallVar}%` : '—',
        },
      ]}
      insight={insight}
    >
      {byGrade.length > 0 && (
        <ChartCard title="各职级固浮比">
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
            {byGrade.map((g: any) => (
              <div key={g.grade} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {g.grade}: {g.fix_pct}:{g.var_pct} ({g.count}人)
              </div>
            ))}
          </div>
        </ChartCard>
      )}

      {byDept.length > 0 && (
        <ChartCard title="各部门固浮比">
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
        </ChartCard>
      )}
    </ModuleShell>
  );
}
