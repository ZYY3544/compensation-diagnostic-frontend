/**
 * 战略解码 V2 展示页 — 7 大模块.
 *
 * 区块:
 *   1. 一句话战略表述
 *   2. BSC 战略地图 (4 层面 + 因果总结)
 *   3. 必赢之仗 MWB (3-7 场, 每场带 5 维度展开 + 主帅副帅 + 一级行动计划)
 *   4. 部门 OGSM (核心部门, 折叠卡片展示)
 *   5. 季度路线图 (Q1-Q4)
 *   6. 一致性检查 (6 大维度 ✓ ⚠ ✗)
 *   7. 高管 PPC 雏形
 */
import { useState } from 'react';
import type {
  SdProfile, SdDecoding, SdMwb, SdDepartmentOgsm, SdBscMap,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

const BSC_META: Array<{ key: keyof SdBscMap; cn: string; en: string; color: string; bg: string }> = [
  { key: 'financial',        cn: '财务层面',     en: 'Financial',         color: '#059669', bg: '#ECFDF5' },
  { key: 'customer',         cn: '客户层面',     en: 'Customer',          color: '#0EA5E9', bg: '#F0F9FF' },
  { key: 'internal_process', cn: '内部流程层面', en: 'Internal Process',  color: '#D97706', bg: '#FFFBEB' },
  { key: 'learning_growth',  cn: '学习成长层面', en: 'Learning & Growth', color: '#7C3AED', bg: '#F5F3FF' },
];

interface Props {
  profile?: SdProfile;
  decoding: SdDecoding;
  onRestart?: () => void;
  onRegenerate?: () => void;
}

export default function SdDecodingView({ decoding, onRestart, onRegenerate }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      padding: '32px 48px 64px',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* 顶部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          {onRegenerate && <button onClick={onRegenerate} style={secondaryBtn}>重新生成解码</button>}
          {onRestart && <button onClick={onRestart} style={secondaryBtn}>重新做战略解码</button>}
        </div>

        {/* 1. 一句话战略表述 */}
        <Section title="① 战略表述">
          <div style={{
            background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
            padding: '24px 28px', fontSize: 16, lineHeight: 1.8, color: '#0F172A',
            fontWeight: 500,
          }}>
            {decoding.strategic_statement}
          </div>
        </Section>

        {/* 2. BSC 战略地图 */}
        <Section title="② BSC 战略地图" subtitle="平衡计分卡 4 层面 — 从下往上的因果链">
          <BscMapView bsc={decoding.bsc_map} />
        </Section>

        {/* 3. 必赢之仗 MWB */}
        <Section title="③ 必须打赢的仗" subtitle={`${decoding.mwbs?.length || 0} 场战略战役 (每场含 5 维度描述 + 主帅副帅 + 一级行动计划)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {decoding.mwbs?.map((mwb, i) => (
              <MwbCard key={mwb.id || i} mwb={mwb} index={i} />
            ))}
          </div>
        </Section>

        {/* 4. 部门 OGSM */}
        <Section title="④ 部门 OGSM" subtitle="核心部门的使命 / 目标 / 策略 / 衡量">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {decoding.department_ogsms?.map((d, i) => (
              <OgsmCard key={i} dept={d} mwbs={decoding.mwbs} />
            ))}
          </div>
        </Section>

        {/* 5. 季度路线图 */}
        <Section title="⑤ 季度路线图">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
          }}>
            {decoding.roadmap?.map((q, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 6,
                  background: BRAND_TINT, color: BRAND, fontSize: 12, fontWeight: 600,
                  marginBottom: 10,
                }}>
                  {q.quarter}
                </div>
                <ul style={{ ...ulStyle, fontSize: 12 }}>
                  {q.milestones?.map((m, j) => (
                    <li key={j} style={{ marginBottom: 6 }}>
                      <div>{m.text}</div>
                      {(m.responsible_dept || m.related_mwb_id) && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          {m.responsible_dept && <span>→ {m.responsible_dept}</span>}
                          {m.related_mwb_id && <span style={{ marginLeft: 6 }}>· {m.related_mwb_id}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. 一致性检查 */}
        <Section title="⑥ 一致性检查" subtitle="基于 KF 战略解码 6 大维度">
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            overflow: 'hidden',
          }}>
            {decoding.consistency_checks?.map((c, i) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderBottom: i < (decoding.consistency_checks.length - 1) ? '1px solid #F1F5F9' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <StatusBadge status={c.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                    {c.category}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    {c.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. 高管 PPC 雏形 */}
        {decoding.exec_ppcs?.length > 0 && (
          <Section title="⑦ 高管 PPC 雏形" subtitle="部门负责人级别的个人绩效合约 (员工级 PPC 留给后续绩效管理工具)">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14,
            }}>
              {decoding.exec_ppcs.map((p, i) => (
                <PpcCard key={i} ppc={p} mwbs={decoding.mwbs} />
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
          基于战略解码 V2 (Korn Ferry 5 层分解模型) 自动生成 ·
          {decoding.generated_at && ` 生成于 ${new Date(decoding.generated_at).toLocaleString('zh-CN')}`}
          {decoding.model_used && ` · ${decoding.model_used}`}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// BSC 战略地图视图 — 4 层面卡片 + 因果总结
// ============================================================================
function BscMapView({ bsc }: { bsc: SdBscMap }) {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14,
      }}>
        {BSC_META.map(meta => (
          <div key={meta.key} style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            padding: '16px 20px', borderLeft: `4px solid ${meta.color}`,
          }}>
            <div style={{
              fontSize: 11, color: meta.color, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
            }}>
              {meta.en}
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>
              {meta.cn}
            </div>
            {(bsc?.[meta.key] as any[])?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(bsc[meta.key] as any[]).map((node, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', background: meta.bg, borderRadius: 6,
                    fontSize: 13, color: '#0F172A',
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{node.goal}</div>
                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                      指标: {node.measure}
                      {node.target_value && <span style={{ color: meta.color, fontWeight: 600 }}> · 目标: {node.target_value}</span>}
                    </div>
                    {node.rationale && (
                      <div style={{ fontSize: 11, color: '#64748B', marginTop: 4, fontStyle: 'italic' }}>
                        {node.rationale}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#CBD5E1', fontStyle: 'italic' }}>(暂无内容)</div>
            )}
          </div>
        ))}
      </div>
      {bsc?.causal_summary && (
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 8,
          padding: '14px 18px', fontSize: 13, color: '#0F172A', lineHeight: 1.7,
        }}>
          <span style={{ fontWeight: 600, color: BRAND }}>因果传导逻辑: </span>
          {bsc.causal_summary}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MWB 卡片 — 折叠展开,展开后显示 5 维度 + 主帅副帅 + 行动计划
// ============================================================================
function MwbCard({ mwb, index }: { mwb: SdMwb; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* 标题栏 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '16px 20px', cursor: 'pointer',
          background: expanded ? BRAND_TINT : '#fff',
          borderBottom: expanded ? `1px solid ${BRAND}33` : 'none',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: BRAND, color: '#fff',
          fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{index + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
            {mwb.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            主帅: <span style={{ color: BRAND, fontWeight: 600 }}>{mwb.commander_role || '未任命'}</span>
            {mwb.vice_commander_role && (
              <> · 副帅: <span style={{ color: '#475569' }}>{mwb.vice_commander_role}</span></>
            )}
            <span style={{ marginLeft: 12, color: '#94A3B8' }}>
              {mwb.level1_actions?.length || 0} 条一级行动
            </span>
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#94A3B8' }}>
          {expanded ? '−' : '+'}
        </div>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 5 维度描述 - 左 2 列 + 右 1 列 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <BoxList title="为什么 (Why)" items={mwb.why} color="#0EA5E9" />
            <BoxList title="关键衡量指标" items={mwb.key_metrics} color="#059669" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <BoxList title="是什么" items={mwb.is_what} color="#7C3AED" />
            <BoxList title="不是什么" items={mwb.is_not_what} color="#94A3B8" />
          </div>
          <BoxList title="成功时的样子" items={mwb.success_picture} color={BRAND} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <BoxList title="难点" items={mwb.difficulties} color="#DC2626" small />
            <BoxList title="有利因素" items={mwb.positive_factors} color="#059669" small />
            <BoxList title="阻碍因素" items={mwb.negative_factors} color="#D97706" small />
          </div>
          <BoxList title="关键驱动因素" items={mwb.key_drivers} color="#7C3AED" />

          {/* 一级行动计划 */}
          {mwb.level1_actions?.length > 0 && (
            <div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#0F172A',
                marginTop: 8, marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{
                  width: 4, height: 16, background: BRAND, borderRadius: 2,
                }} />
                一级行动计划 ({mwb.level1_actions.length} 条)
              </div>
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
                overflow: 'hidden',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>行动 (动词+宾语)</th>
                      <th style={{ ...thStyle, width: 80 }}>完成时间</th>
                      <th style={{ ...thStyle, width: 100 }}>责任人</th>
                      <th style={thStyle}>里程碑 / 衡量指标</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mwb.level1_actions.map((a, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                        <td style={{ ...tdStyle, color: '#94A3B8' }}>{i + 1}</td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{a.action}</td>
                        <td style={{ ...tdStyle, color: BRAND }}>{a.due_date}</td>
                        <td style={tdStyle}>{a.owner_role}</td>
                        <td style={tdStyle}>
                          {a.milestones?.length ? (
                            <ul style={{ ...ulStyle, fontSize: 11, marginBottom: 4 }}>
                              {a.milestones.map((m, j) => <li key={j}>{m}</li>)}
                            </ul>
                          ) : null}
                          {a.metrics?.length ? (
                            <div style={{ fontSize: 11, color: '#64748B' }}>
                              <span style={{ fontWeight: 600 }}>指标: </span>
                              {a.metrics.join(' / ')}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 部门 OGSM 卡片
// ============================================================================
function OgsmCard({ dept, mwbs }: { dept: SdDepartmentOgsm; mwbs: SdMwb[] }) {
  const [expanded, setExpanded] = useState(false);
  const mwbMap = new Map(mwbs?.map(m => [m.id, m]) || []);
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '14px 20px', cursor: 'pointer',
          background: expanded ? '#F8FAFC' : '#fff',
          borderBottom: expanded ? '1px solid #E2E8F0' : 'none',
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}
      >
        <div style={{
          padding: '4px 10px', borderRadius: 6, background: '#F1F5F9',
          fontSize: 13, fontWeight: 600, color: '#475569', flexShrink: 0,
        }}>
          {dept.department}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 2 }}>
            O · 使命
          </div>
          <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.6 }}>
            {dept.objective}
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
            {dept.goals?.length || 0} 个目标 ·
            {' '}{dept.goals?.reduce((sum, g) => sum + (g.strategies?.length || 0), 0) || 0} 个策略
          </div>
        </div>
        <div style={{ fontSize: 18, color: '#94A3B8' }}>
          {expanded ? '−' : '+'}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {dept.goals?.map((g, i) => (
            <div key={i} style={{
              background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, color: BRAND, fontWeight: 700, marginBottom: 4 }}>
                G · 目标 {i + 1}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 10 }}>
                {g.goal}
              </div>
              {g.strategies?.length > 0 && (
                <div style={{
                  background: '#fff', borderRadius: 6, padding: '4px 0',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <th style={{ ...thStyle, width: 50 }}>优先级</th>
                        <th style={thStyle}>策略 (S)</th>
                        <th style={thStyle}>衡量指标 (M)</th>
                        <th style={{ ...thStyle, width: 80 }}>关联 MWB</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.strategies.map((s, j) => (
                        <tr key={j} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                          <td style={tdStyle}>
                            <PriorityBadge priority={s.priority} />
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{s.strategy}</td>
                          <td style={tdStyle}>
                            {s.measures?.length ? (
                              <ul style={{ ...ulStyle, fontSize: 11 }}>
                                {s.measures.map((m, k) => <li key={k}>{m}</li>)}
                              </ul>
                            ) : null}
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11 }}>
                            {s.related_mwb_id && (
                              <span title={mwbMap.get(s.related_mwb_id)?.title} style={{
                                color: BRAND, fontWeight: 600, cursor: 'help',
                              }}>
                                {s.related_mwb_id}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 高管 PPC 卡片
// ============================================================================
function PpcCard({ ppc, mwbs }: { ppc: import('../api/client').SdExecPpc; mwbs: SdMwb[] }) {
  const mwbMap = new Map(mwbs?.map(m => [m.id, m]) || []);
  const totalWeight = ppc.organizational_kpis?.reduce((s, k) => s + (k.weight_pct || 0), 0) || 0;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{
        fontSize: 11, color: BRAND, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
      }}>
        高管 PPC
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
        {ppc.exec_role}
      </div>
      {ppc.is_commander_of && ppc.is_commander_of.length > 0 && (
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
          主帅:{' '}
          {ppc.is_commander_of.map((mwbId, i) => (
            <span key={mwbId}>
              {i > 0 && ' / '}
              <span title={mwbMap.get(mwbId)?.title} style={{ color: BRAND, fontWeight: 600 }}>
                {mwbId}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 组织 KPI */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 6 }}>
          组织 KPI ({totalWeight}%)
        </div>
        {ppc.organizational_kpis?.map((k, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 10px', background: '#F8FAFC', borderRadius: 6,
            marginBottom: 4, fontSize: 12,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, color: '#0F172A' }}>{k.kpi}</div>
              <div style={{ fontSize: 11, color: '#64748B' }}>目标: {k.target}</div>
            </div>
            <div style={{
              padding: '2px 8px', borderRadius: 4, background: BRAND_TINT,
              color: BRAND, fontSize: 11, fontWeight: 600,
            }}>
              {k.weight_pct}%
            </div>
          </div>
        ))}
      </div>

      {/* 述职维度 */}
      {ppc.review_dimensions?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>
            主管述职维度
          </div>
          <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
            {ppc.review_dimensions.join(' / ')}
          </div>
        </div>
      )}

      {/* 个人能力提升 */}
      {ppc.capability_development?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>
            个人能力提升 (参考项)
          </div>
          <ul style={{ ...ulStyle, fontSize: 12 }}>
            {ppc.capability_development.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 通用组件
// ============================================================================
function BoxList({ title, items, color, small }: {
  title: string; items?: string[]; color: string; small?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8,
      padding: small ? '10px 12px' : '12px 16px',
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{
        fontSize: small ? 11 : 12, color, fontWeight: 700,
        marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3,
      }}>
        {title}
      </div>
      <ul style={{ ...ulStyle, fontSize: small ? 12 : 13, marginBottom: 0 }}>
        {items.map((it, i) => <li key={i} style={{ marginBottom: 4 }}>{it}</li>)}
      </ul>
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

function PriorityBadge({ priority }: { priority: string }) {
  const isH = priority === 'H' || priority.includes('高');
  const isM = priority === 'M' || priority.includes('中');
  const color = isH ? '#DC2626' : isM ? '#D97706' : '#059669';
  const bg = isH ? '#FEF2F2' : isM ? '#FFFBEB' : '#ECFDF5';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: bg, color,
    }}>
      {priority}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 12, color: '#475569', lineHeight: 1.6,
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
