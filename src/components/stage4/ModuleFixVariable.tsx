import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleFixVariable({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const byGrade = data?.pay_mix_by_grade || [];
  const byDept = data?.pay_mix_by_dept || [];
  const overallFix = data?.overall_fix_pct;
  const overallVar = data?.overall_var_pct;

  // 副标题：整体固浮比 + 健康区间标记
  const subtitleParts: string[] = [];
  if (overallFix != null && overallVar != null) {
    subtitleParts.push(`整体固浮比 ${overallFix}:${overallVar}`);
  } else if (overallFix != null) {
    subtitleParts.push(`整体固薪占比 ${overallFix}%`);
  }
  if (overallFix != null) {
    if (overallFix >= 60 && overallFix <= 80) subtitleParts.push('健康区间');
    else subtitleParts.push('⚠ 偏离 60-80% 健康区间');
  }
  const subtitle = subtitleParts.join(' · ') || '固定 vs 浮动薪酬比例';

  // 按职级图表发现：固薪占比最高 / 最低的职级
  let gradeFinding = '';
  if (byGrade.length > 0) {
    const withFix = byGrade.filter((g: any) => g.fix_pct != null);
    if (withFix.length > 0) {
      const sorted = [...withFix].sort((a, b) => b.fix_pct - a.fix_pct);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      gradeFinding = `固薪占比最高的是 ${top.grade}（${top.fix_pct}%），最低的是 ${bottom.grade}（${bottom.fix_pct}%）`;
    }
  }

  // 按部门图表发现：浮薪占比最高 / 最低的部门
  let deptFinding = '';
  if (byDept.length > 0) {
    const withVar = byDept.filter((d: any) => d.var_pct != null);
    if (withVar.length > 0) {
      const sorted = [...withVar].sort((a, b) => b.var_pct - a.var_pct);
      const top = sorted[0];
      const bottom = sorted[sorted.length - 1];
      deptFinding = `浮薪占比最高的部门是${top.department}（${top.var_pct}%），最低的是${bottom.department}（${bottom.var_pct}%）`;
    }
  }

  return (
    <ModuleShell
      title="薪酬结构分析"
      subtitle={subtitle}
      insight={insight}
      insightLoading={insightLoading}
    >
      {byGrade.length > 0 && (
        <ChartCard title="各职级固浮比" finding={gradeFinding}>
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
        <ChartCard title="各部门固浮比" finding={deptFinding}>
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
