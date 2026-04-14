import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ModuleLaborCost({ data, insight }: { data: any; insight?: string }) {
  const kpi = data?.kpi || {};
  const trend = data?.trend || [];
  const headcount = data?.current_headcount || 0;

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>人工成本趋势</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        {data?.has_trend_data ? '人工成本多年变化趋势' : '仅当年数据（缺少公司经营数据表）'}
      </div>
      {insight && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {insight}
        </div>
      )}

      {/* KPI 卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
            {kpi.total_cost_wan ? `${kpi.total_cost_wan}万` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>年度总人工成本</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>{headcount}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>在职人数</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
            {kpi.per_head_cost ? `¥${Math.round(kpi.per_head_cost).toLocaleString()}` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>人均人工成本</div>
        </div>
      </div>

      {/* 更多 KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: kpi.cost_revenue_ratio && kpi.cost_revenue_ratio > 30 ? '#DC2626' : 'var(--green)' }}>
            {kpi.cost_revenue_ratio != null ? `${kpi.cost_revenue_ratio}%` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>人工成本/营收</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
            {kpi.revenue_per_head != null ? `${kpi.revenue_per_head}万` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>人均营收</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--blue)' }}>
            {kpi.profit_per_head != null ? `${kpi.profit_per_head}万` : '—'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>人均利润</div>
        </div>
      </div>

      {/* 趋势折线图 */}
      {trend.length > 1 && (
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>人工成本趋势</div>
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
        </div>
      )}
    </div>
  );
}
