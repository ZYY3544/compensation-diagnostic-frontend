import { useState, useEffect, useRef } from 'react';

interface BarData {
  name: string;
  value: number;
  label_top: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  baselineValue?: number;
  baselineLabel?: string;
  colorFn?: (v: number) => string;
}

function BarChart({ data, height = 180, baselineValue, baselineLabel, colorFn }: BarChartProps) {
  const [animated, setAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const maxVal = Math.max(...data.map(d => d.value));
  const range = maxVal * 1.25;
  const baselinePos = baselineValue ? ((baselineValue / range) * 100) : null;

  return (
    <div ref={ref} style={{ position: 'relative', height, paddingTop: 24, paddingBottom: 28 }}>
      {baselinePos !== null && (
        <div className="baseline" style={{ bottom: `${baselinePos}%` }}>
          <span className="baseline-label">{baselineLabel}</span>
        </div>
      )}
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

interface TabPayPerformanceProps {
  data?: any;
}

export default function TabPayPerformance({ data }: TabPayPerformanceProps) {
  const crData: BarData[] = data?.cr_by_performance
    ? data.cr_by_performance.map((d: any) => ({
        name: d.performance,
        value: d.cr,
        label_top: d.cr.toFixed(2),
      }))
    : [];

  const raiseData: BarData[] = data?.raise_by_performance
    ? data.raise_by_performance.map((d: any) => ({
        name: d.performance,
        value: d.raise_pct,
        label_top: `${d.raise_pct}%`,
      }))
    : [];

  const statusBadge = data?.status === 'normal' ? 'badge-green' : 'badge-amber';
  const statusText = data?.status === 'normal' ? '正常' : '需关注';
  const insight = data?.insight || '';

  if (crData.length === 0 && raiseData.length === 0) {
    return (
      <div className="fade-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>薪酬绩效相关性</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>薪酬绩效相关性</span>
        <span className={`badge ${statusBadge}`} style={{ marginLeft: 'auto' }}>{statusText}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>绩效等级 vs 平均 CR</div>
          <BarChart
            data={crData}
            height={220}
            baselineValue={1.0}
            baselineLabel="CR=1.0"
            colorFn={v => v >= 1.0 ? 'var(--green)' : v >= 0.95 ? 'var(--amber)' : 'var(--red)'}
          />
        </div>
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 12 }}>调薪分化度</div>
          <BarChart
            data={raiseData}
            height={220}
            colorFn={(v) => {
              const maxRaise = Math.max(...raiseData.map(d => d.value));
              const opacity = 0.4 + (v / (maxRaise || 12)) * 0.6;
              return `rgba(10,102,194,${opacity})`;
            }}
          />
        </div>
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
