/**
 * 五个诊断模块共用的视觉骨架：标题 + 副标题 → 核心指标卡片 → 图表 → AI 解读
 * 统一布局保证模块间一致，AI 解读靠左边框 + 浅灰底视觉弱化（次于图表）。
 */
import type { ReactNode } from 'react';

export interface MetricItem {
  label: string;
  value: string | number | null | undefined;
  sub?: string;
  color?: string;
}

interface ModuleShellProps {
  title: string;
  subtitle: string;
  metrics?: MetricItem[];
  insight?: string;
  children: ReactNode;
}

export default function ModuleShell({ title, subtitle, metrics, insight, children }: ModuleShellProps) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{subtitle}</div>

      {metrics && metrics.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${metrics.length}, 1fr)`,
          gap: 12,
          marginBottom: 16,
        }}>
          {metrics.map((m, i) => (
            <div key={i} style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '14px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{m.label}</div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: m.color || 'var(--text-primary)',
              }}>
                {m.value ?? '—'}
              </div>
              {m.sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{m.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 图表区：children 之间靠 gap:16 形成卡片间距 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>

      {insight && (
        <div style={{
          marginTop: 16,
          padding: '10px 14px',
          background: '#F8FAFC',
          borderLeft: '3px solid #CBD5E1',
          borderRadius: 4,
          fontSize: 12,
          lineHeight: 1.7,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
        }}>
          {insight}
        </div>
      )}
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
