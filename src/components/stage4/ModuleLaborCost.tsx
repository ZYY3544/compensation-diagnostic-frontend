import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleLaborCost({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const kpi = data?.kpi || {};
  const trend = data?.trend || [];
  const headcount = data?.current_headcount || 0;

  const ratioColor = kpi.cost_revenue_ratio == null ? undefined
    : kpi.cost_revenue_ratio > 30 ? '#DC2626'
    : 'var(--green)';

  return (
    <ModuleShell
      title="人工成本趋势"
      subtitle={data?.has_trend_data ? '人工成本多年变化趋势' : '仅当年数据（缺少公司经营数据表）'}
      metrics={[
        {
          label: '年度总人工成本',
          value: kpi.total_cost_wan ? `${kpi.total_cost_wan}万` : '—',
        },
        {
          label: '人均人工成本',
          value: kpi.per_head_cost ? `¥${Math.round(kpi.per_head_cost).toLocaleString()}` : '—',
          sub: `${headcount} 人在职`,
        },
        ...(kpi.cost_revenue_ratio != null ? [{
          label: '人工成本/营收',
          value: `${kpi.cost_revenue_ratio}%`,
          color: ratioColor,
          sub: kpi.cost_revenue_ratio > 30 ? '⚠ 高于 30% 警戒线' : '健康区间',
        }] : []),
      ]}
      insight={insight}
      insightLoading={insightLoading}
    >
      {(kpi.revenue_per_head != null || kpi.profit_per_head != null) && (
        <ChartCard title="人均经营效益">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {kpi.revenue_per_head != null && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{kpi.revenue_per_head}万</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>人均营收</div>
              </div>
            )}
            {kpi.profit_per_head != null && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)' }}>{kpi.profit_per_head}万</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>人均利润</div>
              </div>
            )}
          </div>
        </ChartCard>
      )}

      {trend.length > 1 && (
        <ChartCard title="人工成本趋势">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}万`} />
              <Tooltip formatter={(v: any) => [v ? `${v}万` : '—', '']} />
              <Legend />
              <Line type="monotone" dataKey="cost" name="人工成本" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
              {trend.some((t: any) => t.revenue) && (
                <Line type="monotone" dataKey="revenue" name="营收" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </ModuleShell>
  );
}
