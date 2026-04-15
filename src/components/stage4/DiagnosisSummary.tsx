/**
 * 诊断关键发现 —— 按 5 个维度展示 AI 生成的关键发现。
 * 后端 prompt（diagnosis_summary.txt）严格按以下格式输出，5 段，每段独立一行维度名 + 1-3 句发现文本。
 */

const DIMENSIONS = ['外部竞争力', '内部公平性', '薪酬结构', '绩效关联', '人工成本'] as const;

interface Props {
  findings_text?: string;        // 5 维度结构化文本（来自 getDiagnosisSummary 的 opening 字段）
  loading?: boolean;
}

function parseDimensions(text: string): Array<{ name: string; finding: string }> {
  if (!text) return [];
  const sections: Array<{ name: string; finding: string }> = [];
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const name = DIMENSIONS[i];
    const startIdx = text.indexOf(name);
    if (startIdx === -1) continue;
    // 找下一个维度名作为结束边界（按文本顺序找最近的）
    let endIdx = text.length;
    for (let j = 0; j < DIMENSIONS.length; j++) {
      if (j === i) continue;
      const otherIdx = text.indexOf(DIMENSIONS[j], startIdx + name.length);
      if (otherIdx !== -1 && otherIdx < endIdx) endIdx = otherIdx;
    }
    const content = text.slice(startIdx + name.length, endIdx).trim();
    if (content) sections.push({ name, finding: content });
  }
  return sections;
}

export default function DiagnosisSummary({ findings_text, loading }: Props) {
  const sections = findings_text ? parseDimensions(findings_text) : [];

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '24px 28px',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>
        诊断关键发现
      </div>

      {loading && sections.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', padding: '12px 0' }}>
          Sparky 正在分析五个维度的关键发现…
        </div>
      )}

      {sections.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {sections.map(s => (
            <div key={s.name}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--brand)',
                marginBottom: 6,
              }}>
                {s.name}
              </div>
              <div style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}>
                {s.finding}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 解析失败时降级直接显示原文，避免 AI 改了格式后用户什么都看不到 */}
      {!loading && findings_text && sections.length === 0 && (
        <div style={{
          fontSize: 13,
          lineHeight: 1.7,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
        }}>
          {findings_text}
        </div>
      )}
    </div>
  );
}
