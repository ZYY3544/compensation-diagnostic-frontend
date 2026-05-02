/**
 * 员工敬业度调研 (EES) 完整报告展示页 — 7 大区块.
 *
 * 区块:
 *   1. 执行总览
 *   2. Double E 调研数据 (敬业度/支持度/4 类员工/部门差异 — 真实定量)
 *   3. 4 大维度解读 (engagement_findings — LLM 基于数据写)
 *   4. Top 3 优势 + Top 3 短板 (基于 14 维度)
 *   5. 行业实践对标
 *   6. 优化建议 (战略层 / 体系层 / 运营层 3 类)
 *   7. 后续工具推荐
 *
 * 注: layer_findings 字段保留但不再渲染 (兼容老 OD V1 数据).
 */
import { useNavigate } from 'react-router-dom';
import type {
  OdDiagnosis, OdRecommendation,
  OdDiagnosisDoubleESummary, OdDoubleEDimension, OdDoubleEBreakdownRow,
  OdEngagementFindings,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

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

        {/* 2. Double E 调研数据 (真实定量) */}
        {diagnosis.double_e_summary && (
          <DoubleESection summary={diagnosis.double_e_summary} />
        )}

        {/* 3. 4 大维度解读 (LLM 基于数据写) */}
        {diagnosis.engagement_findings && (
          <EngagementFindingsSection findings={diagnosis.engagement_findings} />
        )}

        {/* 4. Top 优势 + 短板 */}
        <Section title="④ Top 优势 / 短板维度" subtitle="基于 Double E 14 维度赞同比 + 双基准差距">
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

        {/* 5. 行业实践对标 */}
        {diagnosis.industry_benchmarks?.length > 0 && (
          <Section title="⑤ 行业实践对标" subtitle="跟领先企业的差距识别">
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
        <Section title="⑥ 优化建议" subtitle="按战略层 / 体系层 / 运营层 3 类排序">
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
          <Section title="⑦ 后续工具推荐" subtitle="基于诊断发现, 引导到铭曦其他工具继续深化">
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

// ============================================================
// Double E 员工调研 — 真实定量数据 section
// ============================================================
// ============================================================
// ③ engagement_findings — 4 大维度的 LLM 解读
// ============================================================
function EngagementFindingsSection({ findings }: { findings: OdEngagementFindings }) {
  const blocks = [
    { key: 'engagement_observation',  label: '员工敬业度 (我想做)',  color: BRAND,      tint: BRAND_TINT },
    { key: 'enablement_observation',  label: '组织支持度 (我能做)',  color: '#2563EB',  tint: '#EFF6FF' },
    { key: 'quadrant_observation',    label: '4 类员工分布解读',     color: '#16A34A',  tint: '#F0FDF4' },
    { key: 'department_observation',  label: '部门差异解读',         color: '#7C3AED',  tint: '#F5F3FF' },
  ] as const;

  return (
    <Section title="③ 关键洞察 (Sparky 解读)" subtitle="基于真实数据 + 客户背景, 4 大维度的诊断观察">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {blocks.map(b => {
          const text = findings[b.key as keyof OdEngagementFindings];
          if (!text) return null;
          return (
            <div key={b.key} style={{
              background: '#fff', border: `1px solid ${b.color}33`,
              borderLeft: `4px solid ${b.color}`,
              borderRadius: 10, padding: '18px 22px',
            }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: b.color, marginBottom: 10,
                display: 'inline-block', padding: '3px 10px',
                background: b.tint, borderRadius: 10,
              }}>{b.label}</div>
              <div style={{
                fontSize: 13, color: '#0F172A', lineHeight: 1.85,
                whiteSpace: 'pre-wrap',
              }}>{text}</div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DoubleESection({ summary }: { summary: OdDiagnosisDoubleESummary }) {
  const overall = summary.overall;
  const quad = overall.quadrant_distribution || {};
  const deptRows = (summary.breakdown?.department || []).slice(0, 5);

  return (
    <Section
      title="② Double E 调研数据"
      subtitle={`基于 ${summary.response_count} 份匿名答卷 — 综合得分 / 4 类员工分布 / Top-Bottom 维度 / 部门差异`}
    >
      {/* 综合得分 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
        marginBottom: 18,
      }}>
        <ScorePanel label="员工敬业度 (Engagement)" subtitle="我想做" pct={overall.engagement_score} color={BRAND} />
        <ScorePanel label="组织支持度 (Enablement)" subtitle="我能做" pct={overall.enablement_score} color="#2563EB" />
      </div>

      {/* 4 类员工分布 */}
      <div style={{
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
        padding: '20px 22px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 14 }}>
          4 类员工分布
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { k: 'high_performer', label: '高效',  desc: '敬业 + 支持都到位', color: '#16A34A' },
            { k: 'frustrated',     label: '受挫',  desc: '想做事但缺资源',   color: '#EA580C' },
            { k: 'detached',       label: '漠然',  desc: '支持够 + 不投入',  color: '#3B82F6' },
            { k: 'low_performer',  label: '低效',  desc: '都不到位',        color: '#DC2626' },
          ].map(c => {
            const v = quad[c.k] || { count: 0, percentage: 0 };
            return (
              <div key={c.k} style={{
                padding: '14px 14px',
                background: `${c.color}11`, border: `1.5px solid ${c.color}`,
                borderRadius: 10, textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, color: c.color, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 22, color: c.color, fontWeight: 700, margin: '6px 0' }}>{v.percentage}%</div>
                <div style={{ fontSize: 10, color: '#64748B', marginBottom: 3 }}>{v.count} 人</div>
                <div style={{ fontSize: 10, color: '#94A3B8', fontStyle: 'italic' }}>{c.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top 3 / Bottom 3 维度 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <DimensionsCard title="✓ Top 3 优势维度" dims={summary.top_3_dimensions} positive />
        <DimensionsCard title="✗ Bottom 3 短板维度" dims={summary.bottom_3_dimensions} positive={false} />
      </div>

      {/* 部门差异 */}
      {deptRows.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
              部门差异 (Top {deptRows.length} by 人数)
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={thStyle}>部门</th>
                <th style={{ ...thStyle, width: 70, textAlign: 'right' }}>人数</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>员工敬业度</th>
                <th style={{ ...thStyle, width: 100, textAlign: 'right' }}>组织支持度</th>
              </tr>
            </thead>
            <tbody>
              {deptRows.map((r: OdDoubleEBreakdownRow) => (
                <tr key={r.value} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{r.value}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.count}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: BRAND, fontWeight: 600 }}>
                    {r.engagement_score}%
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#2563EB', fontWeight: 600 }}>
                    {r.enablement_score}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function ScorePanel({ label, subtitle, pct, color }: {
  label: string; subtitle: string; pct: number; color: string;
}) {
  return (
    <div style={{
      padding: '20px 22px',
      background: `${color}08`, border: `1.5px solid ${color}33`,
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>"{subtitle}"</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color, lineHeight: 1.1 }}>{pct}%</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>赞同比 (Top 2 Box)</div>
    </div>
  );
}

function DimensionsCard({ title, dims, positive }: {
  title: string; dims: OdDoubleEDimension[]; positive: boolean;
}) {
  const tone = positive ? '#16A34A' : '#DC2626';
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: tone, marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dims.map(d => (
          <div key={d.name} style={{
            padding: '10px 12px', background: '#F8FAFC',
            border: '1px solid #E2E8F0', borderRadius: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#0F172A', marginBottom: 4 }}>{d.name}</div>
            <div style={{ fontSize: 11, color: '#64748B' }}>
              <b style={{ color: tone, fontSize: 13 }}>{d.agree}%</b> 赞同
              {d.gap_cn !== null && (
                <span style={{
                  color: d.gap_cn >= 0 ? '#16A34A' : '#DC2626',
                  marginLeft: 8, fontWeight: 500,
                }}>
                  vs 中国全行业 {d.gap_cn >= 0 ? '+' : ''}{d.gap_cn}
                </span>
              )}
              {d.gap_global !== null && (
                <span style={{
                  color: d.gap_global >= 0 ? '#16A34A' : '#DC2626',
                  marginLeft: 8, fontWeight: 500,
                }}>
                  vs 全球高绩效 {d.gap_global >= 0 ? '+' : ''}{d.gap_global}
                </span>
              )}
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
