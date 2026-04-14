interface Chip {
  icon: string;
  label: string;
  onClick: () => void;
}

interface Props {
  chips?: Chip[];
}

export default function WelcomeView({ chips = [] }: Props) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 560 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🐻</div>
        <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 8, color: '#1a1a2e' }}>你好，我是 Sparky</div>
        <div style={{ fontSize: 14, color: '#8b8b9e', marginBottom: 32, lineHeight: 1.6 }}>
          你的 AI 薪酬顾问。不管是做一次完整的薪酬诊断，<br />还是快速查一个岗位的市场行情，直接跟我说就行。
        </div>
        {chips.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {chips.map((c, i) => (
              <button
                key={i}
                onClick={c.onClick}
                style={{
                  padding: '10px 16px', borderRadius: 10, fontSize: 13,
                  border: '1px solid #e8e8ec', background: '#fff', color: '#4a4a5e',
                  cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.background = '#f0f4ff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8ec'; e.currentTarget.style.color = '#4a4a5e'; e.currentTarget.style.background = '#fff'; }}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
