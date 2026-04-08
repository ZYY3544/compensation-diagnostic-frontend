import { useState, useEffect } from 'react';

export default function TabFixVariable() {
  const ratioData = [
    { level: 'L3', fixed: 72000, variable: 12000, fixPct: 86, varPct: 14 },
    { level: 'L4', fixed: 96000, variable: 18000, fixPct: 84, varPct: 16 },
    { level: 'L5', fixed: 132000, variable: 36000, fixPct: 79, varPct: 21 },
    { level: 'L6', fixed: 168000, variable: 60000, fixPct: 74, varPct: 26 },
    { level: 'L7', fixed: 216000, variable: 96000, fixPct: 69, varPct: 31 },
    { level: 'L8', fixed: 276000, variable: 156000, fixPct: 64, varPct: 36 },
  ];
  const maxTotal = Math.max(...ratioData.map(d => d.fixed + d.variable));

  const compareData = [
    { level: 'L3', company: '86:14', market: '80:20', diff: '固定偏高' },
    { level: 'L4', company: '84:16', market: '80:20', diff: '固定偏高' },
    { level: 'L5', company: '79:21', market: '75:25', diff: '接近' },
    { level: 'L6', company: '74:26', market: '70:30', diff: '接近' },
    { level: 'L7', company: '69:31', market: '65:35', diff: '接近' },
    { level: 'L8', company: '64:36', market: '60:40', diff: '接近' },
  ];

  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>薪酬固浮比</span>
        <span className="badge badge-green" style={{ marginLeft: 'auto' }}>正常</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>各职级固浮比</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220, paddingTop: 20, paddingBottom: 28 }}>
            {ratioData.map((d, i) => {
              const total = d.fixed + d.variable;
              const heightPct = animated ? (total / maxTotal) * 100 : 0;
              const fixedHeightPct = (d.fixed / total) * 100;
              const variableHeightPct = (d.variable / total) * 100;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4, fontWeight: 600, whiteSpace: 'nowrap' }}>{d.fixPct}:{d.varPct}</div>
                  <div style={{
                    width: '100%',
                    height: `${heightPct}%`,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '4px 4px 0 0',
                    overflow: 'hidden',
                    transition: 'height 0.8s ease'
                  }}>
                    <div style={{ height: `${variableHeightPct}%`, background: '#CA7C5E', minHeight: 2 }} title={`浮动: ¥${(d.variable / 1000).toFixed(0)}k`}></div>
                    <div style={{ height: `${fixedHeightPct}%`, background: 'var(--blue)', minHeight: 2 }} title={`固定: ¥${(d.fixed / 1000).toFixed(0)}k`}></div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>{d.level}</div>
                </div>
              );
            })}
          </div>
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot" style={{ background: 'var(--blue)' }}></span>固定</span>
            <span className="legend-item"><span className="legend-dot" style={{ background: '#CA7C5E' }}></span>浮动</span>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>固浮比对比</div>
          <table className="s-table" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>职级</th><th>公司固浮比</th><th>市场参考</th><th>差异</th></tr>
            </thead>
            <tbody>
              {compareData.map((row, ri) => (
                <tr key={ri}>
                  <td>{row.level}</td>
                  <td>{row.company}</td>
                  <td>{row.market}</td>
                  <td style={{ color: row.diff === '接近' ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>{row.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">
          整体呈合理梯度：越高职级浮动越多。但 L3-L4 浮动占比偏低（14-16%），市场通常 20%。建议适当增加基层绩效奖金比例，增强激励感知。
        </div>
      </div>
    </div>
  );
}
