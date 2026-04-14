import { useEffect, useRef, useState, type ReactNode } from 'react';

export type WorkspaceMode = 'hidden' | 'narrow' | 'wide' | 'fullscreen';

interface Props {
  mode: WorkspaceMode;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  onModeChange?: (mode: WorkspaceMode) => void;
}

// 切模式时的默认起始宽度（px）
const MODE_DEFAULT_WIDTH: Record<WorkspaceMode, number> = {
  hidden: 0,
  narrow: 440,
  wide: 720,
  fullscreen: 0,  // 全屏走单独逻辑
};

const MIN_WIDTH = 380;           // 最窄：保证卡片能渲染
// 最宽：留给左侧对话区至少 420px，否则聊天会挤死

export default function Workspace({ mode, title, subtitle, children, onModeChange }: Props) {
  // 可变宽度：用户拖过后记住；切 mode 时用默认值重置
  const [width, setWidth] = useState<number>(MODE_DEFAULT_WIDTH[mode] || 440);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);

  // mode 切换时重置宽度
  useEffect(() => {
    if (mode !== 'hidden' && mode !== 'fullscreen') {
      setWidth(MODE_DEFAULT_WIDTH[mode]);
    }
  }, [mode]);

  // 拖拽监听
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      // workspace 位于右侧 → 宽度 = window 宽 - 鼠标 X
      const newWidth = window.innerWidth - e.clientX;
      const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - 420);
      const clamped = Math.min(maxWidth, Math.max(MIN_WIDTH, newWidth));
      setWidth(clamped);
    };
    const onUp = () => {
      draggingRef.current = false;
      setIsDragging(false);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging]);

  if (mode === 'hidden') return null;

  const isFullscreen = mode === 'fullscreen';

  return (
    <div
      style={{
        width: isFullscreen ? '100%' : width,
        minWidth: isFullscreen ? 0 : MIN_WIDTH,
        height: '100%',           // 撑满 flex-row 父高度，独立滚动
        overflowY: 'auto',        // 自己的滚动容器，不跟左侧对话区联动
        padding: '24px 28px',
        background: '#f9fafb',
        borderLeft: '1px solid var(--border)',
        transition: isDragging ? 'none' : 'width 0.2s',
        position: isFullscreen ? 'absolute' : 'relative',
        top: 0, right: 0, bottom: 0, zIndex: isFullscreen ? 10 : 1,
      }}
    >
      {/* 拖拽把手：左边沿一条 5px 宽的可拖动区域 */}
      {!isFullscreen && (
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            draggingRef.current = true;
            setIsDragging(true);
          }}
          style={{
            position: 'absolute',
            top: 0, bottom: 0, left: -2,
            width: 5,
            cursor: 'col-resize',
            zIndex: 5,
            background: isDragging ? 'var(--brand)' : 'transparent',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!draggingRef.current) (e.currentTarget as HTMLDivElement).style.background = 'var(--border)';
          }}
          onMouseLeave={(e) => {
            if (!draggingRef.current) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
          }}
          title="拖动调整宽度"
        />
      )}

      {/* Header —— 只保留全屏按钮，移除 ◀▶ 模式切换（改用拖拽边框） */}
      {(title || onModeChange) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            {title && <div style={{ fontSize: 15, fontWeight: 500, color: '#6b6b7e', marginBottom: 2 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: '#a0a0b0' }}>{subtitle}</div>}
          </div>
          {onModeChange && (
            <button
              onClick={() => onModeChange(isFullscreen ? 'wide' : 'fullscreen')}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '1px solid var(--border)', background: '#fff',
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
              title={isFullscreen ? '退出全屏' : '全屏'}
            >
              {isFullscreen ? '✕' : '⛶'}
            </button>
          )}
        </div>
      )}

      <div>{children}</div>
    </div>
  );
}
