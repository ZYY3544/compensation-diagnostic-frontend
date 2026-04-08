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

function Heatmap() {
  const depts = ['研发', '销售', '市场', 'HR', '行政'];
  const levels = ['L3', 'L4', 'L5', 'L6', 'L7', 'L8'];
  const data: (number | null)[][] = [
    [1.05, 1.07, 1.04, 1.02, 1.07, 1.03],
    [0.92, 0.97, 0.88, 0.84, 0.89, null],
    [0.95, 0.89, 0.91, 0.88, null, 0.90],
    [0.83, 0.82, 0.81, null, null, null],
    [0.89, 0.85, null, null, null, null],
  ];
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
        <tr><th></th>{levels.map(l => <th key={l}>{l}</th>)}</tr>
      </thead>
      <tbody>
        {depts.map((dept, di) => (
          <tr key={dept}>
            <td style={{ textAlign: 'right', paddingRight: 10, color: 'var(--text-secondary)', fontSize: 12 }}>{dept}</td>
            {data[di].map((v, li) => (
              <td key={li}><span className={`heatmap-cell ${cellClass(v)}`}>{v !== null ? v.toFixed(2) : '—'}</span></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function TabExternalComp() {
  const hbarData: HBarData[] = [
    { name: '研发', value: 1.05, color: 'var(--green)', label_right: '1.05' },
    { name: '产品', value: 0.98, color: 'var(--amber)', label_right: '0.98' },
    { name: '销售', value: 0.88, color: 'var(--red)', label_right: '0.88' },
    { name: '人力资源', value: 0.82, color: 'var(--red)', label_right: '0.82' },
    { name: '行政', value: 0.85, color: 'var(--red)', label_right: '0.85' },
  ];
  return (
    <div className="fade-enter">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <span style={{ fontSize: 16, color: 'var(--blue)', fontWeight: 600 }}>外部竞争力</span>
        <span className="badge badge-red" style={{ marginLeft: 'auto' }}>预警</span>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 16 }}>各职能薪酬竞争力 (CR)</div>
          <HBarChart data={hbarData} maxVal={1.2} />
        </div>
        <div className="card">
          <div className="card-title" style={{ fontSize: 13, marginBottom: 16 }}>CR 热力矩阵（部门 × 职级）</div>
          <Heatmap />
        </div>
      </div>
      <div className="insight-card">
        <div className="insight-title">⚡ Sparky 洞察</div>
        <div className="insight-text">
          你提到销售团队流失严重，从数据来看确实如此——销售 L4-L5 的 CR 值仅 0.84-0.88，低于市场中位值 12-16%，薪酬竞争力不足很可能是流失的核心原因。研发竞争力良好（CR 1.05），但你的核心创收职能薪酬却明显偏低，建议在调薪预算中优先向销售倾斜。
        </div>
      </div>
    </div>
  );
}
