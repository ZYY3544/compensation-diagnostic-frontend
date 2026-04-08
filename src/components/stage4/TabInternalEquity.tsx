export default function TabInternalEquity() {
  const deviationData = [
    { dept: '研发', values: ['+8%', '+14%', '+12%', '+9%'] },
    { dept: '销售', values: ['-5%', '+3%', '-8%', '-12%'] },
    { dept: '市场', values: ['-2%', '-7%', '-4%', '-6%'] },
    { dept: 'HR', values: ['-12%', '-10%', '-15%', '—'] },
    { dept: '行政', values: ['-8%', '-5%', '—', '—'] },
  ];
  const levels = ['L3', 'L4', 'L5', 'L6'];
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

  const dispersionData = [
    { level: 'L3', coeff: '0.18', ratio: '1.4', status: '正常', statusColor: 'var(--green)' },
    { level: 'L4', coeff: '0.25', ratio: '1.8', status: '正常', statusColor: 'var(--green)' },
    { level: 'L5', coeff: '0.32', ratio: '2.3', status: '偏高', statusColor: 'var(--amber)' },
    { level: 'L6', coeff: '0.22', ratio: '1.9', status: '正常', statusColor: 'var(--green)' },
    { level: 'L7', coeff: '0.28', ratio: '1.7', status: '正常', statusColor: 'var(--green)' },
  ];

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>内部公平性</span>
        <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>需关注</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>部门薪酬偏离度</div>
          <table className="s-table" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>部门</th>{levels.map(l => <th key={l}>{l}</th>)}</tr>
            </thead>
            <tbody>
              {deviationData.map((row, ri) => (
                <tr key={ri}>
                  <td>{row.dept}</td>
                  {row.values.map((v, vi) => (
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
              {dispersionData.map((row, ri) => (
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
        <div className="insight-text">
          L5 层级离散度偏高（离散系数 0.32，极差比 2.3），主要由研发与非研发岗薪酬差异导致。同级别研发薪酬高于非研发约 30%，如认同市场定价差异则合理，否则需考虑引入职能津贴。
        </div>
      </div>
    </div>
  );
}
