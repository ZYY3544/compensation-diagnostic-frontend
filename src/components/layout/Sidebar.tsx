export interface ConversationItem {
  id: string;
  title: string;
  type: 'diagnosis' | 'quick' | 'follow_up';
  updated_at: string;
  active?: boolean;
}

interface Props {
  conversations?: ConversationItem[];
  onNewChat?: () => void;
  onStartDiagnosis?: () => void;
  onSelect?: (id: string) => void;
  userName?: string;
  userRole?: string;
}

// Lucide 风格的 compose / edit 图标——用于"新对话"
function IconCompose({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// BarChart3 —— 用于"薪酬诊断"
function IconBarChart({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.5" />
      <rect x="12" y="8" width="3" height="10" rx="0.5" />
      <rect x="17" y="4" width="3" height="14" rx="0.5" />
    </svg>
  );
}

// 侧栏主按钮：图标 + 文字，默认无底色，hover 切品牌橙 tint
function SidebarButton({
  icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '10px 12px',
        border: 'none', background: 'transparent',
        color: 'var(--text-primary)',           /* 对齐 Sparky 标题色 #1E293B */
        fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
        borderRadius: 10,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--brand-tint)';
        e.currentTarget.style.color = 'var(--brand)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-primary)';
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function Sidebar({
  conversations = [], onNewChat, onStartDiagnosis, onSelect,
  userName = '用户', userRole = 'HR',
}: Props) {
  return (
    <div style={{
      width: 240, minWidth: 240, background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', color: 'var(--text-primary)',
    }}>
      {/* 主要操作区：新对话 + 薪酬诊断 */}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SidebarButton icon={<IconCompose />} label="新对话" onClick={onNewChat} />
        <SidebarButton icon={<IconBarChart />} label="薪酬诊断" onClick={onStartDiagnosis} />
      </div>

      {/* 最近 */}
      <div style={{
        padding: '12px 16px 6px', fontSize: 11, color: 'var(--text-muted)',
        fontWeight: 500, letterSpacing: 0.2,
      }}>
        最近
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {conversations.length === 0 ? (
          <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>
            暂无历史对话
          </div>
        ) : conversations.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            style={{
              padding: '8px 10px', borderRadius: 6, fontSize: 13,
              color: c.active ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: c.active ? 'var(--hover)' : 'transparent',
              cursor: 'pointer', marginBottom: 1,
              display: 'flex', alignItems: 'center', gap: 8,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (!c.active) e.currentTarget.style.background = 'var(--hover)'; }}
            onMouseLeave={e => { if (!c.active) e.currentTarget.style.background = 'transparent'; }}
          >
            {c.title}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--hover)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500,
        }}>
          {userName[0]}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{userName} · {userRole}</div>
      </div>
    </div>
  );
}
