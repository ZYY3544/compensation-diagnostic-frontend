interface Finding {
  priority?: string;
  severity: string;
  module?: string;
  text: string;
}

interface Props {
  healthScore: number;
  findings: Finding[];
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  P1: { bg: '#FEE2E2', color: '#991B1B' },
  P2: { bg: '#FEF3C7', color: '#92400E' },
  P3: { bg: '#DBEAFE', color: '#1E40AF' },
};

export default function DiagnosisSummary({ healthScore, findings }: Props) {
  // 健康分颜色
  const scoreColor = healthScore >= 70 ? 'var(--green)' : healthScore >= 50 ? '#D97706' : '#DC2626';

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 健康分 + 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `3px solid ${scoreColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 700, color: scoreColor,
        }}>
          {healthScore}
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>薪酬诊断报告</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            健康度 {healthScore} 分 · {findings.length} 条核心发现
          </div>
        </div>
      </div>

      {/* 核心发现卡片 */}
      {findings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {findings.map((f, i) => {
            const pc = PRIORITY_COLORS[f.priority || 'P3'] || PRIORITY_COLORS.P3;
            return (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '12px 16px', background: '#fff',
                  border: '1px solid var(--border)', borderRadius: 8,
                  borderLeft: `4px solid ${pc.color}`,
                }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 10, background: pc.bg, color: pc.color,
                  flexShrink: 0,
                }}>
                  {f.priority}
                </span>
                <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {f.text}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
