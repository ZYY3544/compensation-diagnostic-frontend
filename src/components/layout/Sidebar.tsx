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
  onOpenToolGallery?: () => void;
  onCollapse?: () => void;
  onSelect?: (id: string) => void;
  userName?: string;
  userRole?: string;
}

// PanelLeft —— sidebar 收起按钮
function IconCollapse({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
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

// LayoutGrid —— 用于"Tool"（工具集合入口）
function IconGrid({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
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
  conversations = [], onNewChat, onOpenToolGallery, onCollapse, onSelect,
  userName = '用户', userRole = 'HR',
}: Props) {
  return (
    <div style={{
      width: 240, minWidth: 240, height: '100%',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', color: 'var(--text-primary)',
      overflow: 'hidden',      // 内部对话列表用 flex:1 + overflowY:auto 独立滚，外框不跟着动
    }}>
      {/* 顶部 toggle 按钮（收起 sidebar） */}
      {onCollapse && (
        <div style={{ padding: '12px 12px 4px', display: 'flex', justifyContent: 'flex-start' }}>
          <button onClick={onCollapse}
            aria-label="收起侧栏"
            style={{
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 'none', borderRadius: 8,
              color: 'var(--text-secondary)', cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}>
            <IconCollapse />
          </button>
        </div>
      )}

      {/* 主要操作区：新对话 + Tool（工具集合） */}
      <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <SidebarButton icon={<IconCompose />} label="新对话" onClick={onNewChat} />
        <SidebarButton icon={<IconGrid />} label="Tool" onClick={onOpenToolGallery} />
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
