/**
 * 战略澄清产出展示 — 钻石模型 + 6 项质量测试 + 一致性 / 完整性。
 *
 * 区块:
 *   1. 一句话战略表述 (头部)
 *   2. 钻石模型 5 元素 (5 个 section,带编号)
 *   3. 6 项质量测试 (✓ ⚠ ✗ status)
 *   4. 内部一致性观察 (consistency_warnings)
 *   5. 完整性 gaps (可回访谈补充)
 */
import type { ScDiamond } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

const ELEMENT_META: Array<{ key: keyof ScDiamond['diamond']; n: number; cn: string; en: string; hint: string }> = [
  { key: 'arenas',          n: 1, cn: '竞争领域', en: 'Arenas',          hint: '在哪里玩' },
  { key: 'vehicles',        n: 2, cn: '方式',     en: 'Vehicles',        hint: '怎么到达' },
  { key: 'differentiators', n: 3, cn: '差异化',   en: 'Differentiators', hint: '怎么获胜' },
  { key: 'staging',         n: 4, cn: '节奏',     en: 'Staging',         hint: '什么先做' },
  { key: 'economic_logic',  n: 5, cn: '盈利模式', en: 'Economic Logic',  hint: '怎么赚钱' },
];

interface Props {
  diamond: ScDiamond;
  onRestart?: () => void;
  onRegenerate?: () => void;
}

export default function ScDiamondView({ diamond, onRestart, onRegenerate }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      padding: '32px 48px 64px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 顶部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          {onRegenerate && <button onClick={onRegenerate} style={secondaryBtn}>重新生成钻石模型</button>}
          {onRestart && <button onClick={onRestart} style={secondaryBtn}>重新做战略澄清</button>}
        </div>

        {/* 1. 一句话战略表述 */}
        <Section title="战略表述">
          <div style={{
            background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
            padding: '24px 28px', fontSize: 16, lineHeight: 1.8, color: '#0F172A',
            fontWeight: 500,
          }}>
            {diamond.strategic_statement}
          </div>
        </Section>

        {/* 2. 钻石模型 5 元素 */}
        <Section
          title="钻石模型 5 元素"
          subtitle="基于 Korn Ferry / 汉姆布瑞克 / 弗雷德里克森的钻石模型整理"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ELEMENT_META.map(meta => (
              <ElementCard
                key={meta.key}
                meta={meta}
                content={diamond.diamond?.[meta.key] || ''}
              />
            ))}
          </div>
        </Section>

        {/* 3. 质量测试 */}
        <Section title="6 项战略质量测试" subtitle="基于汉姆布瑞克 / 弗雷德里克森的标准">
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            overflow: 'hidden',
          }}>
            {diamond.quality_tests?.map((t, i) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderBottom: i < (diamond.quality_tests.length - 1) ? '1px solid #F1F5F9' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <StatusBadge status={t.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                    {t.criterion}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    {t.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 4. 一致性观察 */}
        {diamond.consistency_warnings?.length > 0 && (
          <Section
            title="内部一致性观察"
            subtitle="5 元素之间的张力 / 加固关系"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {diamond.consistency_warnings.map((w, i) => (
                <div key={i} style={{
                  background: '#fff', border: '1px solid #E2E8F0',
                  borderLeft: `3px solid ${BRAND}`,
                  borderRadius: 8, padding: '12px 16px',
                  fontSize: 13, color: '#475569', lineHeight: 1.7,
                }}>
                  {w}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 5. 完整性 gaps */}
        {diamond.completeness_gaps?.length > 0 && (
          <Section
            title="完整性 gap"
            subtitle="信息不足的元素 — 建议回去补充访谈,否则下游战略解码会受限"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {diamond.completeness_gaps.map((g, i) => (
                <div key={i} style={{
                  background: '#FFFBEB', border: '1px solid #FDE68A',
                  borderRadius: 8, padding: '12px 16px',
                  fontSize: 13, color: '#92400E', lineHeight: 1.7,
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1.4 }}>⚠</span>
                  <div>{g}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 底部 */}
        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 11, color: '#94A3B8', textAlign: 'center',
        }}>
          基于战略澄清访谈 (5 元素) 自动生成 ·
          {diamond.generated_at && ` 生成于 ${new Date(diamond.generated_at).toLocaleString('zh-CN')}`}
          {diamond.model_used && ` · ${diamond.model_used}`}
          <br />
          下游可衔接「战略解码」工具,把这份战略翻译成部门 KPI、关键岗位、季度路线图
        </div>
      </div>
    </div>
  );
}

function ElementCard({ meta, content }: {
  meta: { n: number; cn: string; en: string; hint: string };
  content: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 22px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: BRAND_TINT,
          color: BRAND, fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{meta.n}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
            {meta.cn} <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 400 }}>{meta.en}</span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            {meta.hint}
          </div>
        </div>
      </div>
      <div style={{
        paddingLeft: 44, fontSize: 13, color: '#475569', lineHeight: 1.8,
      }}>
        {content ? renderMd(content) : (
          <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>(信息不足)</span>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ marginBottom: 14 }}>
        <h2 style={{
          fontSize: 16, fontWeight: 700, color: '#0F172A',
          margin: 0, letterSpacing: -0.1,
        }}>
          {title}
        </h2>
        {subtitle && (
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPass = status.includes('✓') || status.includes('通过');
  const isFail = status.includes('✗') || status.includes('风险');
  const color = isPass ? '#059669' : isFail ? '#DC2626' : '#D97706';
  const bg = isPass ? '#ECFDF5' : isFail ? '#FEF2F2' : '#FFFBEB';
  const icon = isPass ? '✓' : isFail ? '✗' : '⚠';
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700, color, flexShrink: 0,
    }}>
      {icon}
    </div>
  );
}

function renderMd(text: string): React.ReactNode {
  const lines = text.split('\n').filter(l => l.trim());
  return (
    <>
      {lines.map((line, i) => {
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) => {
          if (p.startsWith('**') && p.endsWith('**')) {
            return <span key={j} style={{ color: '#0F172A', fontWeight: 600 }}>{p.slice(2, -2)}</span>;
          }
          return <span key={j}>{p}</span>;
        });
        return <div key={i}>{parts}</div>;
      })}
    </>
  );
}

const secondaryBtn: React.CSSProperties = {
  padding: '7px 16px', fontSize: 12, fontWeight: 500,
  background: '#fff', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 6,
  cursor: 'pointer',
};
