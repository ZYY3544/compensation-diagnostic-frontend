import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ModuleShell, { ChartCard } from './ModuleShell';

export default function ModuleLaborCost({ data, insight, insightLoading }: { data: any; insight?: string; insightLoading?: boolean }) {
  const kpi = data?.kpi || {};
  const trend = data?.trend || [];
  const headcount = data?.current_headcount || 0;

  // 副标题：年度总人工成本 + 人均 + 占营收比例
  const subtitleParts: string[] = [];
  if (kpi.total_cost_wan != null) subtitleParts.push(`年度 ${kpi.total_cost_wan} 万`);
  if (headcount > 0) subtitleParts.push(`${headcount} 人`);
  if (kpi.cost_revenue_ratio != null) {
    const warn = kpi.cost_revenue_ratio > 30 ? '⚠ ' : '';
    subtitleParts.push(`${warn}占营收 ${kpi.cost_revenue_ratio}%`);
  }
  const subtitle = subtitleParts.join(' · ') || (data?.has_trend_data ? '人工成本多年变化趋势' : '仅当年数据');

  // 人均经营效益发现
  let efficiencyFinding = '';
  if (kpi.revenue_per_head != null && kpi.profit_per_head != null) {
    efficiencyFinding = `人均创收 ${kpi.revenue_per_head} 万，人均贡献利润 ${kpi.profit_per_head} 万`;
  } else if (kpi.revenue_per_head != null) {
    efficiencyFinding = `人均创收 ${kpi.revenue_per_head} 万`;
  } else if (kpi.profit_per_head != null) {
    efficiencyFinding = `人均贡献利润 ${kpi.profit_per_head} 万`;
  }

  // 趋势图发现：年均增长率
  let trendFinding = '';
  if (trend.length >= 2) {
    const first = trend[0];
    const last = trend[trend.length - 1];
    if (first?.cost && last?.cost && first.year && last.year) {
      const years = last.year - first.year;
      if (years > 0) {
        const cagr = (Math.pow(last.cost / first.cost, 1 / years) - 1) * 100;
        trendFinding = `${first.year} → ${last.year}，人工成本从 ${first.cost} 万增至 ${last.cost} 万（年均 ${cagr >= 0 ? '+' : ''}${cagr.toFixed(1)}%）`;
      }
    }
  }

  return (
    <ModuleShell
      title="人工成本趋势"
      subtitle={subtitle}
      insight={insight}
      insightLoading={insightLoading}
    >
      {(kpi.revenue_per_head != null || kpi.profit_per_head != null) && (
        <ChartCard title="人均经营效益" finding={efficiencyFinding}>
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
        <ChartCard title="人工成本趋势" finding={trendFinding}>
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
