/**
 * 五个诊断模块共用的三层骨架：
 * 1. 顶部：模块标题 + 一行副标题（关键指标概要）
 * 2. 维度总结区：AI 解读（module-insight 接口），浅底色卡片醒目展示
 * 3. 图表区：每个图表独立 ChartCard，卡片结构 = 标题 + 代码生成的图表发现 + 图表本身
 *
 * 分工：
 * - 维度总结（insight）走 AI（定性判断）
 * - 图表发现（finding）走代码（确定性数据提取，如"CR 最高的是 X（Y）"），不调 AI
 */
import type { ReactNode } from 'react';

interface ModuleShellProps {
  title: string;
  subtitle: string;
  insight?: string;
  insightLoading?: boolean;
  children: ReactNode;
}

export default function ModuleShell({ title, subtitle, insight, insightLoading, children }: ModuleShellProps) {
  return (
    <div>
      {/* 1. 顶部：标题 + 一行副标题 */}
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{title}</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{subtitle}</div>

      {/* 2. 维度总结区：AI 解读，浅底色卡片 */}
      {(insight || insightLoading) && (
        <div style={{
          marginBottom: 20,
          padding: '14px 18px',
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          fontStyle: insightLoading ? 'italic' : 'normal',
          opacity: insightLoading ? 0.7 : 1,
        }}>
          {insightLoading ? 'Sparky 正在解读这个维度…' : insight}
        </div>
      )}

      {/* 3. 图表区：children 之间靠 gap:16 形成卡片间距 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {children}
      </div>
    </div>
  );
}

export function ChartCard({ title, finding, children }: { title: string; finding?: string; children: ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 20,
    }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: finding ? 6 : 12 }}>{title}</div>
      {finding && (
        <div style={{
          fontSize: 13,
          color: 'var(--text-muted)',
          marginBottom: 12,
          lineHeight: 1.5,
        }}>
          {finding}
        </div>
      )}
      {children}
    </div>
  );
}
