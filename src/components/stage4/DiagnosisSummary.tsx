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
  const scoreColor = healthScore >= 70 ? 'var(--green)' : healthScore >= 50 ? '#D97706' : '#DC2626';
  const scoreLabel = healthScore >= 70 ? '健康' : healthScore >= 50 ? '需关注' : '风险偏高';

  return (
    <div style={{ marginBottom: 24 }}>
      {/* 健康分独立卡片：大字居中 */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '32px 24px',
        textAlign: 'center',
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 64,
          fontWeight: 700,
          color: scoreColor,
          lineHeight: 1,
          marginBottom: 8,
        }}>
          {healthScore}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
          薪酬健康度评分
        </div>
        <div style={{ fontSize: 12, color: scoreColor, fontWeight: 600 }}>
          {scoreLabel} · {findings.length} 条核心发现
        </div>
      </div>

      {/* 关键发现列表 */}
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
