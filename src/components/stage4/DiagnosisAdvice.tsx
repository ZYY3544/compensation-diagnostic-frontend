interface Advice {
  priority: string;
  title: string;
  detail: string;
  module?: string;
}

interface Props {
  advice: Advice[];
  closing: string;
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  P1: { bg: '#FEE2E2', color: '#991B1B', border: '#DC2626' },
  P2: { bg: '#FEF3C7', color: '#92400E', border: '#D97706' },
  P3: { bg: '#DBEAFE', color: '#1E40AF', border: '#3B82F6' },
};

export default function DiagnosisAdvice({ advice, closing }: Props) {
  if (!advice || advice.length === 0) {
    return null;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>诊断建议</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {advice.map((a, i) => {
          const pc = PRIORITY_COLORS[a.priority] || PRIORITY_COLORS.P3;
          return (
            <div
              key={i}
              style={{
                background: '#fff',
                border: '1px solid var(--border)',
                borderLeft: `4px solid ${pc.border}`,
                borderRadius: 8,
                padding: '16px 20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px',
                  borderRadius: 10, background: pc.bg, color: pc.color,
                }}>
                  {a.priority}
                </span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {a.detail}
              </div>
            </div>
          );
        })}
      </div>

      {closing && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: '#F0F7FF', borderRadius: 8,
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
        }}>
          {closing}
        </div>
      )}
    </div>
  );
}
