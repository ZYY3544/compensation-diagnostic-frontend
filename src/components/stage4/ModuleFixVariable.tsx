import { useEffect, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleFixVariable({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const [dept, setDept] = useState<string>('__all__');

  const overallByGrade = data?.pay_mix_by_grade || [];
  const byDept = data?.pay_mix_by_dept || [];
  const byDeptGrade = data?.pay_mix_by_dept_grade || {};
  const departments = data?.departments || [];
  const overallFix = data?.overall_fix_pct;
  const overallVar = data?.overall_var_pct;

  // 根据筛选项切换数据源
  const byGrade = dept === '__all__' ? overallByGrade : (byDeptGrade[dept] || []);

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
          {/* 部门筛选：公司整体 / 各部门 */}
          {departments.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Dropdown label="范围" value={dept}
                options={[
                  { value: '__all__', label: '公司整体' },
                  ...departments.map((d: string) => ({ value: d, label: d })),
                ]}
                onChange={setDept} />
            </div>
          )}
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byGrade} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(v: any, name: string, ctx: any) => {
                  const row = ctx?.payload || {};
                  const abs = name === '固定薪酬' ? row.fixed : row.variable;
                  return [`${v}%  ·  ¥${Number(abs || 0).toLocaleString()}`, name];
                }} />
              <Legend />
              <Bar dataKey="fix_pct" name="固定薪酬" stackId="a" fill="#3B82F6" maxBarSize={36} />
              <Bar dataKey="var_pct" name="浮动薪酬" stackId="a" fill="#F59E0B" maxBarSize={36} radius={[4, 4, 0, 0]} />
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

      {byDept.length > 0 && dept === '__all__' && (
        <ChartCard title="各部门固浮比" finding={deptFinding}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byDept} layout="vertical" barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="department" width={90} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: any, name: string, ctx: any) => {
                  const row = ctx?.payload || {};
                  const abs = name === '固定' ? row.fixed : row.variable;
                  return [`${v}%  ·  ¥${Number(abs || 0).toLocaleString()}`, name];
                }} />
              <Legend />
              <Bar dataKey="fix_pct" name="固定" stackId="a" fill="#3B82F6" maxBarSize={28} />
              <Bar dataKey="var_pct" name="浮动" stackId="a" fill="#F59E0B" maxBarSize={28} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </ModuleShell>
  );
}

function Dropdown({ label, value, options, onChange }: {
  label: string; value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const current = options.find(o => o.value === value)?.label ?? '';
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '7px 14px', borderRadius: 999,
          border: `1px solid ${open ? '#D85A30' : '#e5e7eb'}`,
          background: open ? '#FEF7F4' : '#fff',
          fontSize: 12, color: '#475569', cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(216,90,48,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
          transition: 'all 0.15s', fontFamily: 'inherit',
        }}>
        <span style={{ color: '#94a3b8', fontSize: 11 }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#0f172a' }}>{current}</span>
        <svg width={10} height={10} viewBox="0 0 16 16" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          minWidth: '100%', whiteSpace: 'nowrap',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 12px 28px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
          padding: 4, zIndex: 50, maxHeight: 280, overflowY: 'auto',
        }}>
          {options.map(o => {
            const sel = o.value === value;
            return (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: '7px 12px', borderRadius: 6, cursor: 'pointer',
                  fontSize: 12,
                  background: sel ? '#FEF2EE' : 'transparent',
                  color: sel ? '#D85A30' : '#475569',
                  fontWeight: sel ? 600 : 400,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                <span>{o.label}</span>
                {sel && <span style={{ fontSize: 10 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
