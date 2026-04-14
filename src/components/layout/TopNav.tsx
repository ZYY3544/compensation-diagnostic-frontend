import PixelCat from '../shared/PixelCat';

interface TopNavProps {
  userName?: string;
  userRole?: string;
}

/**
 * 顶部菜单栏：左边品牌，右边用户菜单位（后续接登录状态）。
 * 高度 48px，固定在三栏上方——给浏览器 chrome 和主内容让出视觉缓冲区。
 */
export default function TopNav({ userName = '用户', userRole = 'HR' }: TopNavProps) {
  return (
    <div style={{
      height: 48, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      background: 'var(--panel-bg)',
      borderBottom: '1px solid var(--border)',
      zIndex: 100,
    }}>
      {/* 左：品牌 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PixelCat size={22} />
        <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)' }}>铭曦</span>
      </div>

      {/* 右：用户菜单位 —— 后续做登录下拉 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{userRole}</span>
        <div
          title={userName}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--hover)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)',
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          {userName[0]}
        </div>
      </div>
    </div>
  );
}
