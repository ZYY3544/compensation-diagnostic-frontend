import type { ReportData } from '../../types';

interface GaugeProps {
  score: number;
}

function Gauge({ score }: GaugeProps) {
  const totalArc = 251.3;
  const offset = totalArc * (1 - score / 100);
  return (
    <svg viewBox="0 0 200 120" width="160">
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E2E8F0" strokeWidth="14" strokeLinecap="round"/>
      <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#0A66C2" strokeWidth="14" strokeLinecap="round"
        strokeDasharray={totalArc} strokeDashoffset={offset} style={{ transition: 'stroke-dashoffset 1.2s ease' }}/>
      <text x="100" y="82" textAnchor="middle" fill="#1E293B" fontSize="32" fontWeight="700">{score}</text>
      <text x="100" y="100" textAnchor="middle" fill="#94A3B8" fontSize="11">薪酬健康度</text>
    </svg>
  );
}

interface ReportOverviewProps {
  reportData?: ReportData | null;
}

export default function ReportOverview({ reportData }: ReportOverviewProps) {
  const score = reportData?.health_score ?? 0;
  const findings = reportData?.key_findings ?? [];

  const severityColor = (s: string) => {
    if (s === 'red') return 'var(--red)';
    if (s === 'amber') return 'var(--amber)';
    return 'var(--green)';
  };

  return (
    <div className="card overview-card" style={{ marginBottom: 24 }}>
      <div className="gauge-wrap">
        <Gauge score={score} />
        <div className="gauge-right">
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>核心发现</div>
          {findings.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', padding: '12px 0' }}>暂无数据</div>
          ) : (
            findings.map((f, i) => (
              <div key={i} className="finding-item">
                <span className="finding-dot" style={{ color: severityColor(f.severity) }}>●</span>
                <span>{f.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
