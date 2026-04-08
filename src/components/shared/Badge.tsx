interface BadgeProps {
  type: 'green' | 'amber' | 'red' | 'blue' | 'gray';
  children: React.ReactNode;
}

const colors = {
  green: { bg: '#DCFCE7', color: '#16A34A' },
  amber: { bg: '#FEF3C7', color: '#D97706' },
  red: { bg: '#FEE2E2', color: '#DC2626' },
  blue: { bg: '#DBEAFE', color: '#1D4ED8' },
  gray: { bg: '#F1F5F9', color: '#64748B' },
};

export default function Badge({ type, children }: BadgeProps) {
  const c = colors[type];
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: '2px 10px', borderRadius: 12,
      fontSize: 12, fontWeight: 500,
    }}>
      {children}
    </span>
  );
}
