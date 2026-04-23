/**
 * ToolGallery：工具卡片网格页（Claude Artifacts 风格）。
 *
 * 4 个工具卡片（薪酬诊断 / 岗位价值评估 / 薪酬设计 / 人才测评），
 * 点击 ready=true 的卡片触发 onSelect 回调，未 ready 的灰色 + "敬请期待" 标签。
 *
 * 占据整个中间对话区，跟 Sidebar 并排。
 */
interface Tool {
  key: string;
  name: string;
  desc: string;
  icon: string;
  ready: boolean;
  badge?: string;  // 可选：右上角标签（v1 / 测试中 等）
}

const TOOLS: Tool[] = [
  {
    key: 'diagnosis',
    name: '薪酬诊断',
    desc: '上传薪酬数据，5 模块全面体检：内部公平、外部竞争力、绩效相关性、激励结构、成本趋势。',
    icon: '📊',
    ready: true,
  },
  {
    key: 'je',
    name: '岗位价值评估',
    desc: '基于 Hay 体系评估岗位价值。粘贴 JD 一键出 8 因子档位 + Hay 标准职级（9-27）。',
    icon: '🎯',
    ready: true,
    badge: 'v1',
  },
  {
    key: 'design',
    name: '薪酬设计',
    desc: '生成调薪方案、薪酬带宽、激励结构。结合诊断和岗位价值结果，输出可落地的薪酬设计。',
    icon: '🎨',
    ready: false,
  },
  {
    key: 'assessment',
    name: '人才测评',
    desc: '心理测评 + 个性化发展建议。基于胜任力模型，提供候选人画像和岗位匹配度分析。',
    icon: '🧠',
    ready: false,
  },
];

interface Props {
  onSelectTool: (key: string) => void;
}

export default function ToolGallery({ onSelectTool }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto',
      background: '#fff',
      padding: '32px 48px 64px',
    }}>
      {/* 标题区 */}
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 700, color: 'var(--text-primary)',
            margin: 0, letterSpacing: -0.2,
          }}>
            Tool
          </h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
            选择一个工具开始
          </div>
        </div>

        {/* 网格 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {TOOLS.map(t => (
            <ToolCard key={t.key} tool={t} onSelect={() => t.ready && onSelectTool(t.key)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool, onSelect }: { tool: Tool; onSelect: () => void }) {
  const disabled = !tool.ready;
  return (
    <div
      onClick={disabled ? undefined : onSelect}
      style={{
        position: 'relative',
        padding: 20,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all 0.15s',
        minHeight: 180,
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--brand)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(202,124,94,0.10)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        if (disabled) return;
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* 右上角徽章 */}
      {(tool.badge || disabled) && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          padding: '2px 8px', fontSize: 10, fontWeight: 600,
          borderRadius: 4,
          background: disabled ? '#F1F5F9' : 'var(--brand-tint)',
          color: disabled ? 'var(--text-muted)' : 'var(--brand)',
        }}>
          {disabled ? '敬请期待' : tool.badge}
        </div>
      )}

      <div style={{ fontSize: 36, marginBottom: 12 }}>{tool.icon}</div>
      <div style={{
        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
        marginBottom: 8,
      }}>
        {tool.name}
      </div>
      <div style={{
        fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6,
        flex: 1,
      }}>
        {tool.desc}
      </div>
    </div>
  );
}
