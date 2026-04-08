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

const mockMetrics = [
  { label: '人工成本/营收', value: '32%', trend: '↑ 偏高', cls: 'up-bad' },
  { label: '人均营收', value: '¥68万', trend: '— 持平', cls: 'neutral' },
  { label: '人均利润', value: '¥12万', trend: '↓ 偏低', cls: 'down-bad' },
  { label: '成本增速 vs 营收', value: '22% vs 15%', trend: '失衡', cls: 'up-bad' },
];

const mockCostData: BarData[] = [
  { name: '2022', value: 1850, label_top: '1,850' },
  { name: '2023', value: 2340, label_top: '2,340' },
  { name: '2024', value: 2890, label_top: '2,890' },
  { name: '2025', value: 3250, label_top: '3,250' },
];

interface TabLaborCostProps {
  data?: any;
}

export default function TabLaborCost({ data }: TabLaborCostProps) {
  const metrics = data?.metrics || mockMetrics;
  const costData: BarData[] = data?.cost_trend
    ? data.cost_trend.map((d: any) => ({
        name: String(d.year),
        value: d.cost,
        label_top: d.cost.toLocaleString(),
      }))
    : mockCostData;

  const statusBadge = data?.status === 'normal' ? 'badge-green' : data?.status === 'unavailable' ? 'badge-amber' : 'badge-red';
  const statusText = data?.status === 'normal' ? '正常' : data?.status === 'unavailable' ? '数据不足' : '预警';
  const insight = data?.insight || '你提到明年的重点是降本增效，数据也显示这很紧迫——人工成本增速（22%）显著高于营收增速（15%），四年成本增长 75%，主要是人员扩张驱动（+48%）。结合你的降本目标，建议控制招聘节奏，同时把有限的调薪预算向销售关键岗位倾斜，而不是撒胡椒面。';

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
