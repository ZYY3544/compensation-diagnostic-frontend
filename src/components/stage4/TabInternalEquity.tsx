const cellBg = (v: string) => {
  if (v === '—') return 'transparent';
  if (v.startsWith('+')) return '#DCFCE7';
  return '#FEE2E2';
};
const cellColor = (v: string) => {
  if (v === '—') return 'var(--text-muted)';
  if (v.startsWith('+')) return 'var(--green)';
  return 'var(--red)';
};

interface TabInternalEquityProps {
  data?: any;
}

export default function TabInternalEquity({ data }: TabInternalEquityProps) {
  const deviationData = data?.deviation || [];
  const levels = data?.deviation_levels || [];

  const dispersionData = data?.dispersion
    ? data.dispersion.map((d: any) => ({
        level: d.grade,
        coeff: typeof d.coefficient === 'number' ? d.coefficient.toFixed(2) : d.coefficient,
        ratio: typeof d.range_ratio === 'number' ? d.range_ratio.toFixed(1) : d.range_ratio,
        status: d.status === 'high' ? '偏高' : '正常',
        statusColor: d.status === 'high' ? 'var(--amber)' : 'var(--green)',
      }))
    : [];

  const statusBadge = data?.status === 'normal' ? 'badge-green' : 'badge-amber';
  const statusText = data?.status === 'normal' ? '正常' : '需关注';
  const insight = data?.insight || '';

  if (deviationData.length === 0 && dispersionData.length === 0) {
    return (
      <div className="fade-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>内部公平性</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>内部公平性</span>
        <span className={`badge ${statusBadge}`} style={{ marginLeft: 'auto' }}>{statusText}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>部门薪酬偏离度</div>
          <table className="s-table" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>部门</th>{levels.map((l: string) => <th key={l}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {deviationData.map((row: any, ri: number) => (
                <tr key={ri}>
                  <td>{row.dept}</td>
                  {row.values.map((v: string, vi: number) => (
                    <td key={vi} style={{ background: cellBg(v), color: cellColor(v), fontWeight: 600, textAlign: 'center' }}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>同级别薪酬离散度</div>
          <table className="s-table" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>职级</th><th>离散系数</th><th>极差比</th><th>状态</th></tr>
            </thead>
            <tbody>
              {dispersionData.map((row: any, ri: number) => (
                <tr key={ri}>
                  <td>{row.level}</td>
                  <td>{row.coeff}</td>
                  <td>{row.ratio}</td>
                  <td style={{ color: row.statusColor, fontWeight: 600 }}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
