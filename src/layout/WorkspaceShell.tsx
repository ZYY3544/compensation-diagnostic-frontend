/**
 * WorkspaceShell：登录后所有工具页的外壳。
 * - 顶部 TopNav：左 logo + 中间工具切换 popover + 右用户菜单
 * - 主体：<Outlet /> 渲染当前路由对应的工具内容
 *
 * 工具切换 popover 设计：
 * - 当前工具高亮 + ✓
 * - 其他 3 个工具显示"敬请期待"，灰色不可点
 * - 未来工具 ready 后激活即可
 */
import { useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import PixelCat from '../components/shared/PixelCat';

interface Tool {
  key: string;
  path: string;
  icon: string;
  name: string;
  desc: string;
  ready: boolean;
}

const TOOLS: Tool[] = [
  { key: 'diagnosis',  path: '/diagnosis',  icon: '📊', name: '薪酬诊断',     desc: '上传薪酬数据 → 5 模块全面体检', ready: true },
  { key: 'je',         path: '/je',         icon: '🎯', name: '岗位价值评估', desc: '基于 Hay 体系评估岗位价值',     ready: false },
  { key: 'design',     path: '/design',     icon: '🎨', name: '薪酬设计',     desc: '生成调薪方案 / 薪酬带宽',       ready: false },
  { key: 'assessment', path: '/assessment', icon: '🧠', name: '人才测评',     desc: '心理测评 + 发展建议',           ready: false },
];

export default function WorkspaceShell() {
  const { user, workspace, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // 当前工具：从 pathname 第一段判断
  const currentToolKey = (loc.pathname.split('/')[1] || 'diagnosis');
  const currentTool = TOOLS.find(t => t.key === currentToolKey) || TOOLS[0];

  // click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolMenuOpen && !toolMenuRef.current?.contains(e.target as Node)) setToolMenuOpen(false);
      if (userMenuOpen && !userMenuRef.current?.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [toolMenuOpen, userMenuOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FAFAFA' }}>
      {/* 顶栏 */}
      <div style={topNavStyle}>
        {/* 左：logo + 品牌 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
          <PixelCat size={26} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>铭曦</div>
        </div>

        {/* 中：工具切换 */}
        <div ref={toolMenuRef} style={{ position: 'relative' }}>
          <button onClick={() => setToolMenuOpen(o => !o)} style={toolBtnStyle(toolMenuOpen)}>
            <span style={{ fontSize: 14 }}>{currentTool.icon}</span>
            <span style={{ fontWeight: 600, color: '#0F172A' }}>{currentTool.name}</span>
            <Chevron open={toolMenuOpen} />
          </button>
          {toolMenuOpen && (
            <div style={popoverStyle}>
              <div style={{ fontSize: 11, color: '#94A3B8', padding: '4px 12px 8px', fontWeight: 500 }}>
                工具
              </div>
              {TOOLS.map(t => {
                const active = t.key === currentToolKey;
                return (
                  <div key={t.key}
                    onClick={() => {
                      if (!t.ready) return;
                      setToolMenuOpen(false);
                      nav(t.path);
                    }}
                    style={toolItemStyle(active, t.ready)}>
                    <span style={{ fontSize: 18 }}>{t.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: t.ready ? '#0F172A' : '#94A3B8' }}>
                        {t.name}
                        {!t.ready && <span style={badgeStyle}>敬请期待</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{t.desc}</div>
                    </div>
                    {active && <span style={{ color: '#D85A30', fontSize: 12 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右：workspace 名 + 用户菜单 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200, justifyContent: 'flex-end' }}>
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
              <div style={{ ...popoverStyle, right: 0, left: 'auto', minWidth: 200 }}>
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width={10} height={10} viewBox="0 0 16 16" fill="none"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const topNavStyle: React.CSSProperties = {
  height: 52, padding: '0 20px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: '#fff', borderBottom: '1px solid #E2E8F0',
  flexShrink: 0,
};
const toolBtnStyle = (open: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 8,
  padding: '7px 14px', borderRadius: 999,
  border: `1px solid ${open ? '#D85A30' : '#E2E8F0'}`,
  background: open ? '#FEF7F4' : '#fff',
  fontSize: 13, color: '#475569', cursor: 'pointer',
  boxShadow: open ? '0 0 0 3px rgba(216,90,48,0.10)' : '0 1px 2px rgba(15,23,42,0.04)',
  transition: 'all 0.15s', fontFamily: 'inherit',
});
const popoverStyle: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 8px)', left: 0,
  minWidth: 280,
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
  boxShadow: '0 12px 28px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
  padding: '8px 4px', zIndex: 100,
};
const toolItemStyle = (active: boolean, ready: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 12,
  padding: '10px 12px', borderRadius: 8,
  cursor: ready ? 'pointer' : 'not-allowed',
  background: active ? '#FEF2EE' : 'transparent',
  opacity: ready ? 1 : 0.6,
});
const badgeStyle: React.CSSProperties = {
  display: 'inline-block', marginLeft: 8,
  padding: '1px 6px', fontSize: 10, fontWeight: 500,
  background: '#F1F5F9', color: '#64748B', borderRadius: 4,
};
const avatarBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: '50%',
  background: '#D85A30', color: '#fff', fontWeight: 600, fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
};
