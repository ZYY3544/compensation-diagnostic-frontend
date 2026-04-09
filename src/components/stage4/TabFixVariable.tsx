import { useState, useEffect } from 'react';

interface TabFixVariableProps {
  data?: any;
}

export default function TabFixVariable({ data }: TabFixVariableProps) {
  const ratioData = data?.ratio_by_grade || [];
  const compareData = data?.comparison || [];
  const maxTotal = ratioData.length > 0 ? Math.max(...ratioData.map((d: any) => (d.fixed || 0) + (d.variable || 0))) : 1;

  const statusBadge = data?.status === 'warning' ? 'badge-amber' : 'badge-green';
  const statusText = data?.status === 'warning' ? '需关注' : '正常';
  const insight = data?.insight || '';

  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  if (ratioData.length === 0 && compareData.length === 0) {
    return (
      <div className="fade-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>薪酬固浮比</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>薪酬固浮比</span>
        <span className={`badge ${statusBadge}`} style={{ marginLeft: 'auto' }}>{statusText}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>各职级固浮比</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 220, paddingTop: 20, paddingBottom: 28 }}>
            {ratioData.map((d: any, i: number) => {
              const total = (d.fixed || 0) + (d.variable || 0);
              const heightPct = animated ? (total / maxTotal) * 100 : 0;
              const fixedHeightPct = total > 0 ? ((d.fixed || 0) / total) * 100 : 0;
              const variableHeightPct = total > 0 ? ((d.variable || 0) / total) * 100 : 0;
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
                    <div style={{ height: `${variableHeightPct}%`, background: '#CA7C5E', minHeight: 2 }} title={`浮动: ¥${((d.variable || 0) / 1000).toFixed(0)}k`}></div>
                    <div style={{ height: `${fixedHeightPct}%`, background: 'var(--blue)', minHeight: 2 }} title={`固定: ¥${((d.fixed || 0) / 1000).toFixed(0)}k`}></div>
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
              {compareData.map((row: any, ri: number) => (
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
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
