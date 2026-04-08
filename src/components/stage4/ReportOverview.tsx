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

// Mock fallback findings
const mockFindings = [
  { severity: 'red', text: '销售团队 L4-L5 竞争力不足，CR 仅 0.84-0.88' },
  { severity: 'amber', text: 'L5 层级内部薪酬离散度偏高，离散系数 0.32' },
  { severity: 'amber', text: '绩效与薪酬关联偏弱，A vs C 差距仅 23%' },
  { severity: 'red', text: '人工成本增速（22%）高于营收增速（15%）' },
];

interface ReportOverviewProps {
  reportData?: ReportData | null;
}

export default function ReportOverview({ reportData }: ReportOverviewProps) {
  const score = reportData?.health_score ?? 72;
  const findings = reportData?.key_findings ?? mockFindings;

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
          {findings.map((f, i) => (
            <div key={i} className="finding-item">
              <span className="finding-dot" style={{ color: severityColor(f.severity) }}>●</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
