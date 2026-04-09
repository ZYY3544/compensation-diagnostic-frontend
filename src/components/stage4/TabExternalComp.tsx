import { useState, useEffect } from 'react';

interface HBarData {
  name: string;
  value: number;
  color: string;
  label_right: string;
}

function HBarChart({ data, maxVal }: { data: HBarData[]; maxVal: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);
  const mx = maxVal || Math.max(...data.map(d => d.value));
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} className="h-bar-row">
          <span className="h-bar-label">{d.name}</span>
          <div className="h-bar-track">
            <div className="h-bar-fill" style={{
              width: animated ? `${(d.value / mx) * 100}%` : '0%',
              background: d.color
            }}>
              <span style={{ color: '#fff' }}>{d.label_right}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ heatmapData }: { heatmapData?: any }) {
  const depts = heatmapData?.departments || [];
  const levels = heatmapData?.levels || [];
  const data: (number | null)[][] = heatmapData?.matrix || [];
  const cellClass = (v: number | null) => {
    if (v === null) return 'heat-empty';
    if (v > 1.05) return 'heat-high';
    if (v >= 0.95) return 'heat-good';
    if (v >= 0.85) return 'heat-warn';
    return 'heat-danger';
  };
  return (
    <table className="heatmap">
      <thead>
        <tr><th></th>{levels.map((l: string) => <th key={l}>{l}</th>)}</tr>
      </thead>
      <tbody>
        {depts.map((dept: string, di: number) => (
          <tr key={dept}>
            <td style={{ textAlign: 'right', paddingRight: 10, color: 'var(--text-secondary)', fontSize: 12 }}>{dept}</td>
            {(data[di] || []).map((v: number | null, li: number) => (
              <td key={li}><span className={`heatmap-cell ${cellClass(v)}`}>{v !== null ? v.toFixed(2) : '—'}</span></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const crColor = (v: number) => {
  if (v >= 1.0) return 'var(--green)';
  if (v >= 0.90) return 'var(--amber)';
  return 'var(--red)';
};

interface TabExternalCompProps {
  data?: any;
}

export default function TabExternalComp({ data }: TabExternalCompProps) {
  const hbarData: HBarData[] = data?.cr_by_function
    ? data.cr_by_function.map((f: any) => ({
        name: f.name,
        value: f.cr,
        color: crColor(f.cr),
        label_right: f.cr.toFixed(2),
      }))
    : [];

  const statusBadge = data?.status === 'warning' ? 'badge-red' : data?.status === 'normal' ? 'badge-green' : 'badge-red';
  const statusText = data?.status === 'warning' ? '预警' : data?.status === 'normal' ? '正常' : '预警';
  const insight = data?.insight || '';

  if (hbarData.length === 0) {
    return (
      <div className="fade-enter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>外部竞争力</span>
        </div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>外部竞争力</span>
        <span className={`badge ${statusBadge}`} style={{ marginLeft: 'auto' }}>{statusText}</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 16 }}>各职能薪酬竞争力 (CR)</div>
          <HBarChart data={hbarData} maxVal={1.2} />
        </div>
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 16 }}>CR 热力矩阵（部门 × 职级）</div>
          <Heatmap heatmapData={data?.heatmap} />
        </div>
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">{insight}</div>
      </div>
    </div>
  );
}
