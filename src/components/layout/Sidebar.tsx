import { useState } from 'react';
import PixelCat from '../shared/PixelCat';

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
        width: 48, background: 'var(--panel-bg)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 12,
      }}>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-muted)',
            width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}
          title="展开"
        >▶</button>
        <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PixelCat size={24} />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 260, minWidth: 260, background: 'var(--panel-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', color: 'var(--text-primary)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PixelCat size={24} />
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>铭曦</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            width: 24, height: 24, borderRadius: 4, border: 'none',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
          }}
          title="收起"
        >◀</button>
      </div>

      {/* 新对话按钮 —— 简化：纯文字链接式 */}
      <button
        onClick={onNewChat}
        style={{
          margin: '12px 12px 4px',
          padding: '10px 12px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'transparent',
          color: 'var(--text-secondary)',
          fontSize: 13,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'border-color 0.15s, color 0.15s, background 0.15s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--brand)';
          e.currentTarget.style.color = 'var(--brand)';
          e.currentTarget.style.background = 'var(--brand-tint)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <span style={{ fontSize: 14 }}>＋</span>
        <span>新对话</span>
      </button>

      {/* 最近 */}
      <div style={{
        padding: '16px 16px 6px', fontSize: 11, color: 'var(--text-muted)',
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
