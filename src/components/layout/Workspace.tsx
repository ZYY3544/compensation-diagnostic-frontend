import type { ReactNode } from 'react';

export type WorkspaceMode = 'hidden' | 'narrow' | 'wide' | 'fullscreen';

interface Props {
  mode: WorkspaceMode;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  onModeChange?: (mode: WorkspaceMode) => void;
}

const MODE_WIDTH: Record<WorkspaceMode, string> = {
  hidden: '0px',
  narrow: '420px',
  wide: '60%',
  fullscreen: '100%',
};

export default function Workspace({ mode, title, subtitle, children, onModeChange }: Props) {
  if (mode === 'hidden') return null;

  const width = MODE_WIDTH[mode];
  const isFullscreen = mode === 'fullscreen';

  return (
    <div
      style={{
        width: isFullscreen ? '100%' : width,
        minWidth: mode === 'narrow' ? 420 : mode === 'wide' ? 600 : 0,
        overflowY: 'auto',
        padding: '24px 28px',
        background: '#f9fafb',
        borderLeft: '1px solid #e8e8ec',
        transition: 'width 0.25s',
        position: isFullscreen ? 'absolute' : 'relative',
        top: 0, right: 0, bottom: 0, zIndex: isFullscreen ? 10 : 1,
      }}
    >
      {/* Header */}
      {(title || onModeChange) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            {title && <div style={{ fontSize: 15, fontWeight: 500, color: '#6b6b7e', marginBottom: 2 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#a0a0b0' }}>{subtitle}</div>}
          </div>
          {onModeChange && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={() => onModeChange(mode === 'narrow' ? 'wide' : 'narrow')}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer' }}
                title={mode === 'narrow' ? '展开' : '收窄'}
              >
                {mode === 'narrow' ? '◀▶' : '▶◀'}
              </button>
              <button
                onClick={() => onModeChange(isFullscreen ? 'wide' : 'fullscreen')}
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer' }}
                title={isFullscreen ? '退出全屏' : '全屏'}
              >
                {isFullscreen ? '✕' : '⛶'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 卡片堆栈 */}
      <div>{children}</div>
    </div>
  );
}
