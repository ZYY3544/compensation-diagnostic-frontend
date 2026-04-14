import { useState } from 'react';

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
  onSelect?: (id: string) => void;
  userName?: string;
  userRole?: string;
}

export default function Sidebar({ conversations = [], onNewChat, onSelect, userName = '用户', userRole = 'HR' }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <div style={{
        width: 48, background: '#1a1a2e', color: '#fff',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 12,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#ccc', width: 28, height: 28, borderRadius: 6, cursor: 'pointer' }}
          title="展开"
        >▶</button>
        <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>铭</div>
      </div>
    );
  }

  return (
    <div style={{ width: 260, minWidth: 260, background: '#1a1a2e', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: '#2563eb', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>铭</div>
          <span style={{ fontSize: 16, fontWeight: 500 }}>铭曦</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#999', cursor: 'pointer' }}
          title="收起"
        >◀</button>
      </div>

      {/* 新对话按钮 */}
      <button
        onClick={onNewChat}
        style={{
          margin: '16px 16px 8px', padding: 10, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: '#ccc', fontSize: 13, cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <span>+</span>
        <span>新对话</span>
      </button>

      {/* 最近列表 */}
      <div style={{ padding: '12px 20px 6px', fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>最近</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {conversations.length === 0 ? (
          <div style={{ padding: 12, fontSize: 12, color: '#555' }}>暂无历史对话</div>
        ) : conversations.map(c => (
          <div
            key={c.id}
            onClick={() => onSelect?.(c.id)}
            style={{
              padding: '10px 12px', borderRadius: 8, fontSize: 13,
              color: c.active ? '#fff' : '#aaa',
              background: c.active ? 'rgba(37,99,235,0.2)' : 'transparent',
              cursor: 'pointer', marginBottom: 2,
              display: 'flex', alignItems: 'center', gap: 10,
            }}
          >
            <span style={{ fontSize: 14, opacity: 0.6 }}>{c.type === 'diagnosis' ? '📊' : '💬'}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2d2d4e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#888' }}>
          {userName[0]}
        </div>
        <div style={{ fontSize: 13, color: '#aaa' }}>{userName} · {userRole}</div>
      </div>
    </div>
  );
}
