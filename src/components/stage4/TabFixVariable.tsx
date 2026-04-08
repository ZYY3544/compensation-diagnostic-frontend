import { useState, useEffect } from 'react';

const mockRatioData = [
  { level: 'L3', fixed: 72000, variable: 12000, fixPct: 86, varPct: 14 },
  { level: 'L4', fixed: 96000, variable: 18000, fixPct: 84, varPct: 16 },
  { level: 'L5', fixed: 132000, variable: 36000, fixPct: 79, varPct: 21 },
  { level: 'L6', fixed: 168000, variable: 60000, fixPct: 74, varPct: 26 },
  { level: 'L7', fixed: 216000, variable: 96000, fixPct: 69, varPct: 31 },
  { level: 'L8', fixed: 276000, variable: 156000, fixPct: 64, varPct: 36 },
];

const mockCompareData = [
  { level: 'L3', company: '86:14', market: '80:20', diff: '固定偏高' },
  { level: 'L4', company: '84:16', market: '80:20', diff: '固定偏高' },
  { level: 'L5', company: '79:21', market: '75:25', diff: '接近' },
  { level: 'L6', company: '74:26', market: '70:30', diff: '接近' },
  { level: 'L7', company: '69:31', market: '65:35', diff: '接近' },
  { level: 'L8', company: '64:36', market: '60:40', diff: '接近' },
];

interface TabFixVariableProps {
  data?: any;
}

export default function TabFixVariable({ data }: TabFixVariableProps) {
  const ratioData = data?.ratio_by_grade || mockRatioData;
  const compareData = data?.comparison || mockCompareData;
  const maxTotal = Math.max(...ratioData.map((d: any) => (d.fixed || 0) + (d.variable || 0)));

  const statusBadge = data?.status === 'warning' ? 'badge-amber' : 'badge-green';
  const statusText = data?.status === 'warning' ? '需关注' : '正常';
  const insight = data?.insight || '整体呈合理梯度：越高职级浮动越多。但 L3-L4 浮动占比偏低（14-16%），市场通常 20%。建议适当增加基层绩效奖金比例，增强激励感知。';

  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

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
