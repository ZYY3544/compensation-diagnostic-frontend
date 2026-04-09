import { useState, useEffect, useRef } from 'react';

interface BarData {
  name: string;
  value: number;
  label_top: string;
}

function BarChart({ data, height = 180, colorFn }: { data: BarData[]; height?: number; colorFn?: (v: number) => string }) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const maxVal = Math.max(...data.map(d => d.value));
  const range = maxVal * 1.25;

  return (
    <div ref={ref} style={{ position: 'relative', height, paddingTop: 24, paddingBottom: 28 }}>
      <div className="bar-chart" style={{ height: height - 52 }}>
        {data.map((d, i) => {
          const pct = animated ? (d.value / range) * 100 : 0;
          const color = colorFn ? colorFn(d.value) : 'var(--blue)';
          return (
            <div key={i} className="bar-wrapper">
              <div className="bar-value">{d.label_top || d.value}</div>
              <div className="bar" style={{ height: `${pct}%`, background: color }} />
              <div className="bar-axis-label">{d.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TabLaborCostProps {
  data?: any;
}

export default function TabLaborCost({ data }: TabLaborCostProps) {
  const metrics = data?.metrics || [];
  const costData: BarData[] = data?.cost_trend
    ? data.cost_trend.map((d: any) => ({
        name: String(d.year),
        value: d.cost,
        label_top: d.cost.toLocaleString(),
      }))
    : [];

  const statusBadge = data?.status === 'normal' ? 'badge-green' : data?.status === 'unavailable' ? 'badge-amber' : 'badge-red';
  const statusText = data?.status === 'normal' ? '正常' : data?.status === 'unavailable' ? '数据不足' : '预警';
  const insight = data?.insight || '';

  if (metrics.length === 0 && costData.length === 0) {
    return (
      <div className="fade-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>人工成本</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>人工成本</span>
        <span className={`badge ${statusBadge}`} style={{ marginLeft: 'auto' }}>{statusText}</span>
      </div>
      <div className="grid-4">
        {metrics.map((m: any, i: number) => (
          <div key={i} className="metric-card">
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className={`metric-trend ${m.cls}`}>{m.trend}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>人工成本趋势（万元）</div>
        <BarChart data={costData} height={220} colorFn={() => 'var(--blue)'} />
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
