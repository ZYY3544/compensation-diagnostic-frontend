/**
 * WorkspaceShell：登录后所有工具页的外壳。
 * - 顶部 TopNav：左 logo + 右 workspace 名 + 用户菜单
 * - 主体：<Outlet /> 渲染当前路由对应的工具内容
 *
 * 工具切换入口已挪到左 sidebar 的 "Tool" 按钮（在 App.tsx / JeApp.tsx 内部）。
 */
import { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function WorkspaceShell() {
  const { user, workspace, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuOpen && !userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userMenuOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FAFAFA' }}>
      {/* 顶栏 */}
      <div style={topNavStyle}>
        {/* 左：占位,保持右侧用户菜单 space-between 对齐 */}
        <div />

        {/* 右：workspace 名 + 用户菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {workspace && (
            <div style={{ fontSize: 12, color: '#64748B' }}>
              {workspace.company_name || workspace.name}
            </div>
          )}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setUserMenuOpen(o => !o)} style={avatarBtnStyle}>
              {(user?.display_name || user?.email || '?')[0].toUpperCase()}
            </button>
            {userMenuOpen && (
              <div style={userPopoverStyle}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{user?.display_name || user?.email}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{user?.email}</div>
                </div>
                <div onClick={logout} style={{
                  padding: '10px 12px', fontSize: 13, color: '#475569', cursor: 'pointer', borderRadius: 6,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  退出登录
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体：当前工具内容 */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Outlet />
      </div>
    </div>
  );
}

const topNavStyle: React.CSSProperties = {
  height: 52, padding: '0 20px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: '#fff', borderBottom: '1px solid #E2E8F0',
  flexShrink: 0,
};
const userPopoverStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
  minWidth: 200,
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
  boxShadow: '0 12px 28px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
  padding: '8px 4px', zIndex: 100,
};
const avatarBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: '#D85A30', color: '#fff', fontWeight: 600, fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
};
