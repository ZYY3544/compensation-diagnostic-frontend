/**
 * 组织诊断 (OD) 完整诊断报告展示页 — 7 大区块.
 *
 * 区块:
 *   1. 执行总览 (executive_summary, 大字号高亮)
 *   2. 5 层面诊断 (status + 现状 + 关键观察 + 痛点)
 *   3. Top 3 优势 + Top 3 短板 (并排)
 *   4. 行业实践对标
 *   5. 优化建议 (战略层 / 体系层 / 运营层 3 类)
 *   6. 后续工具推荐 (引导到铭曦其他工具)
 */
import { useNavigate } from 'react-router-dom';
import type {
  OdDiagnosis, OdLayerFinding, OdRecommendation,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

const LAYER_META: Array<{ key: keyof OdDiagnosis['layer_findings']; cn: string; emoji: string; color: string; bg: string }> = [
  { key: 'strategy',           cn: '战略层',     emoji: '🎯', color: '#0EA5E9', bg: '#F0F9FF' },
  { key: 'organization',       cn: '组织层',     emoji: '🏗️', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'talent',             cn: '人才层',     emoji: '👥', color: '#059669', bg: '#ECFDF5' },
  { key: 'comp_perf',          cn: '薪酬绩效层', emoji: '💰', color: '#D97706', bg: '#FFFBEB' },
  { key: 'culture_leadership', cn: '文化领导力', emoji: '⭐', color: '#DB2777', bg: '#FDF2F8' },
];

const TOOL_META: Record<string, { cn: string; route: string; desc: string }> = {
  sc:                 { cn: '战略澄清',     route: '/sc',         desc: 'KF 钻石模型 5 元素 + 6 项质量测试' },
  sd:                 { cn: '战略解码 V2',  route: '/sd',         desc: 'BSC + MWB + OGSM + 高管 PPC' },
  je:                 { cn: '岗位价值评估', route: '/je',         desc: 'Hay 8 因子评估 + 标准库' },
  salary_diagnostic:  { cn: '薪酬诊断',     route: '/diagnosis',  desc: '5 模块薪酬体检' },
  lti:                { cn: '长期激励',     route: '/lti',        desc: '(规划中) 8 大 LTI 工具选型 + 方案设计' },
};

interface Props {
  diagnosis: OdDiagnosis;
  onRestart?: () => void;
  onRegenerate?: () => void;
}

export default function OdDiagnosisView({ diagnosis, onRestart, onRegenerate }: Props) {
  const nav = useNavigate();
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      padding: '32px 48px 64px',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* 顶部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          {onRegenerate && <button onClick={onRegenerate} style={secondaryBtn}>重新生成诊断</button>}
          {onRestart && <button onClick={onRestart} style={secondaryBtn}>重新做诊断</button>}
        </div>

        {/* 1. 执行总览 */}
        <Section title="① 执行总览">
          <div style={{
            background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
            padding: '24px 28px', fontSize: 15, lineHeight: 1.9, color: '#0F172A',
            whiteSpace: 'pre-wrap',
          }}>
            {diagnosis.executive_summary}
          </div>
        </Section>

        {/* 2. 5 层面诊断 */}
        <Section title="② 5 层面诊断" subtitle="基于 KF 战略-组织-领导三角框架的多角度评估">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {LAYER_META.map(meta => {
              const finding = diagnosis.layer_findings?.[meta.key] as OdLayerFinding | undefined;
              if (!finding) return null;
              return <LayerCard key={meta.key} meta={meta} finding={finding} />;
            })}
          </div>
        </Section>

        {/* 3. Top 优势 + 短板 */}
        <Section title="③ Top 优势 / 短板" subtitle="影响战略实现的关键要素">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FindingsList
              title="Top 优势"
              items={diagnosis.top_strengths}
              color="#059669"
              bg="#ECFDF5"
            />
            <FindingsList
              title="Top 短板"
              items={diagnosis.top_gaps}
              color="#DC2626"
              bg="#FEF2F2"
            />
          </div>
        </Section>

        {/* 4. 行业实践对标 */}
        {diagnosis.industry_benchmarks?.length > 0 && (
          <Section title="④ 行业实践对标" subtitle="跟领先企业的差距识别">
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ ...thStyle, width: 140 }}>对标主题</th>
                    <th style={thStyle}>行业领先实践</th>
                    <th style={thStyle}>客户当前状态</th>
                    <th style={{ ...thStyle, width: 110 }}>差距评估</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosis.industry_benchmarks.map((b, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: '#0F172A' }}>{b.topic}</td>
                      <td style={tdStyle}>{b.industry_practice}</td>
                      <td style={tdStyle}>{b.client_status}</td>
                      <td style={tdStyle}>
                        <GapBadge gap={b.gap_assessment} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* 5. 优化建议 */}
        <Section title="⑤ 优化建议" subtitle="按战略层 / 体系层 / 运营层 3 类排序">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(['strategic', 'systematic', 'operational'] as const).map(level => {
              const items = diagnosis.recommendations?.[level];
              if (!items?.length) return null;
              const meta = level === 'strategic'
                ? { cn: '战略层 (大动作)', desc: '大型咨询项目, 3-6 个月', color: '#DC2626' }
                : level === 'systematic'
                ? { cn: '体系层 (中动作)', desc: '中型项目, 2-4 个月', color: '#D97706' }
                : { cn: '运营层 (小动作)', desc: '内部改进 / 1-2 个月', color: '#059669' };
              return (
                <RecommendationsBlock
                  key={level}
                  title={meta.cn}
                  desc={meta.desc}
                  color={meta.color}
                  items={items}
                />
              );
            })}
          </div>
        </Section>

        {/* 6. 后续工具推荐 */}
        {diagnosis.next_tools?.length > 0 && (
          <Section title="⑥ 后续工具推荐" subtitle="基于诊断发现, 引导到铭曦其他工具继续深化">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12,
            }}>
              {diagnosis.next_tools.map((t, i) => {
                const tool = TOOL_META[t.recommended_tool] || { cn: t.recommended_tool, route: '/', desc: '' };
                return (
                  <div key={i} style={{
                    background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                    padding: '14px 16px',
                    cursor: tool.route !== '/' ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                  }}
                    onClick={() => tool.route !== '/' && nav(tool.route)}
                    onMouseEnter={(e) => {
                      if (tool.route !== '/') {
                        e.currentTarget.style.borderColor = BRAND;
                        e.currentTarget.style.background = BRAND_TINT;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#E2E8F0';
                      e.currentTarget.style.background = '#fff';
                    }}
                  >
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                    }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 6,
                        background: BRAND, color: '#fff',
                        fontSize: 12, fontWeight: 600,
                      }}>{tool.cn}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>→ {tool.desc}</span>
                    </div>
                    <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.6, marginBottom: 6 }}>
                      <span style={{ color: '#64748B', fontSize: 11 }}>关联诊断: </span>
                      {t.related_finding}
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                      <span style={{ color: BRAND, fontWeight: 600 }}>建议理由: </span>
                      {t.why}
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* 底部 */}
        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 11, color: '#94A3B8', textAlign: 'center',
        }}>
          基于组织诊断 (Korn Ferry 战略-组织-领导三角框架) 自动生成 ·
          {diagnosis.generated_at && ` 生成于 ${new Date(diagnosis.generated_at).toLocaleString('zh-CN')}`}
          {diagnosis.model_used && ` · ${diagnosis.model_used}`}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function LayerCard({ meta, finding }: {
  meta: { cn: string; emoji: string; color: string; bg: string };
  finding: OdLayerFinding;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 22px', borderLeft: `4px solid ${meta.color}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
      }}>
        <div style={{
          fontSize: 20, lineHeight: 1,
        }}>{meta.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
            {meta.cn}
          </div>
          {finding.status && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              padding: '2px 10px', borderRadius: 4,
              background: meta.bg, color: meta.color,
              fontSize: 11, fontWeight: 600,
            }}>
              {finding.status}
            </span>
          )}
        </div>
      </div>

      {finding.current_state && (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, color: '#94A3B8', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
          }}>
            现状
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
            {renderMd(finding.current_state)}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {finding.observations?.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: meta.color, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
            }}>
              关键观察
            </div>
            <ul style={{ ...ulStyle, fontSize: 13 }}>
              {finding.observations.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </div>
        )}
        {finding.pain_points?.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: '#DC2626', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6,
            }}>
              痛点
            </div>
            <ul style={{ ...ulStyle, fontSize: 13 }}>
              {finding.pain_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function FindingsList({ title, items, color, bg }: {
  title: string; items: any[]; color: string; bg: string;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 20px', borderTop: `4px solid ${color}`,
    }}>
      <div style={{
        fontSize: 12, color, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 14,
      }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items?.map((item, i) => (
          <div key={i} style={{
            padding: '12px 14px', background: bg, borderRadius: 8,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, marginBottom: 4 }}>
              <span style={{ color, fontWeight: 600 }}>证据: </span>
              {item.evidence}
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>影响: </span>
              {item.impact}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsBlock({ title, desc, color, items }: {
  title: string; desc: string; color: string; items: OdRecommendation[];
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 22px', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A' }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
          {desc}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((rec, i) => (
          <div key={i} style={{
            padding: '12px 14px', background: '#F8FAFC',
            border: '1px solid #E2E8F0', borderRadius: 8,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
            }}>
              <PriorityBadge priority={rec.priority} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                {rec.title}
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>为什么: </span>
              {rec.rationale}
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, marginBottom: 6 }}>
              <span style={{ color: '#64748B', fontWeight: 600 }}>预期影响: </span>
              {rec.expected_impact}
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7 }}>
              <span style={{ color: BRAND, fontWeight: 600 }}>具体动作: </span>
              {rec.suggested_action}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{
          fontSize: 18, fontWeight: 700, color: '#0F172A',
          margin: 0, letterSpacing: -0.2,
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

function GapBadge({ gap }: { gap: string }) {
  const isClose = gap.includes('✓') || gap.includes('接近');
  const isLarge = gap.includes('✗') || gap.includes('显著');
  const color = isClose ? '#059669' : isLarge ? '#DC2626' : '#D97706';
  const bg = isClose ? '#ECFDF5' : isLarge ? '#FEF2F2' : '#FFFBEB';
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: bg, color, whiteSpace: 'nowrap',
    }}>
      {gap}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const isP0 = priority === 'P0';
  const isP1 = priority === 'P1';
  const color = isP0 ? '#DC2626' : isP1 ? '#D97706' : '#059669';
  const bg = isP0 ? '#FEF2F2' : isP1 ? '#FFFBEB' : '#ECFDF5';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: bg, color, fontFamily: 'monospace',
    }}>
      {priority}
    </span>
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

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px', fontSize: 13, color: '#475569', lineHeight: 1.6,
};

const ulStyle: React.CSSProperties = {
  margin: 0, paddingLeft: 16, fontSize: 13, color: '#475569', lineHeight: 1.7,
};

const secondaryBtn: React.CSSProperties = {
  padding: '7px 16px', fontSize: 12, fontWeight: 500,
  background: '#fff', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 6,
  cursor: 'pointer',
};
