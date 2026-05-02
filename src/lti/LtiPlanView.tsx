/**
 * 长期激励 (LTI) 方案设计书展示页 — 6 大区块.
 *
 * 区块:
 *   1. 公司画像总结 (executive summary)
 *   2. 推荐工具 (主推荐 + 备选 + 不推荐)
 *   3. 方案设计 6 要点 (持股模式 / 参与范围 / 总量 / 授予生效 / 业绩链接 / 特殊情况)
 *   4. 个人激励测算 (按角色)
 *   5. 风险提示 (5 类)
 *   6. 后续动作清单 (5 大方向, 含优先级)
 */
import type { LtiPlan, LtiToolRecommendation } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  plan: LtiPlan;
  onRestart?: () => void;
  onRegenerate?: () => void;
}

export default function LtiPlanView({ plan, onRestart, onRegenerate }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      padding: '32px 48px 64px',
    }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* 顶部按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          {onRegenerate && <button onClick={onRegenerate} style={secondaryBtn}>重新生成方案</button>}
          {onRestart && <button onClick={onRestart} style={secondaryBtn}>重新做 LTI</button>}
        </div>

        {/* 1. 公司画像总结 */}
        <Section title="① 公司画像与设计驱动">
          <div style={{
            background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
            padding: '24px 28px', fontSize: 15, lineHeight: 1.9, color: '#0F172A',
            whiteSpace: 'pre-wrap',
          }}>
            {plan.company_summary}
          </div>
        </Section>

        {/* 2. 推荐工具 */}
        <Section title="② 推荐 LTI 工具" subtitle="基于 4 大选择因素 (业务特点 / 股东意愿 / 上市规划 / 市场实践)">
          {plan.recommended_tools?.primary && (
            <PrimaryToolCard tool={plan.recommended_tools.primary} />
          )}
          {plan.recommended_tools?.secondary?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 12, color: '#64748B', fontWeight: 600,
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                备选工具 ({plan.recommended_tools.secondary.length} 个)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 14 }}>
                {plan.recommended_tools.secondary.map((tool, i) => (
                  <SecondaryToolCard key={i} tool={tool} />
                ))}
              </div>
            </div>
          )}
          {plan.recommended_tools?.not_recommended?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                fontSize: 12, color: '#64748B', fontWeight: 600,
                marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                不推荐工具 ({plan.recommended_tools.not_recommended.length} 个)
              </div>
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                overflow: 'hidden',
              }}>
                {plan.recommended_tools.not_recommended.map((nr, i) => (
                  <div key={i} style={{
                    padding: '12px 18px',
                    borderBottom: i < plan.recommended_tools.not_recommended.length - 1 ? '1px solid #F1F5F9' : 'none',
                    display: 'flex', gap: 14,
                  }}>
                    <div style={{
                      padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                      background: '#FEF2F2', color: '#DC2626', whiteSpace: 'nowrap', alignSelf: 'flex-start',
                    }}>
                      ✗ {nr.tool_cn}
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                      {nr.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* 3. 方案设计 6 要点 */}
        <Section title="③ 方案设计 6 要点">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* 持股模式 */}
            <DesignCard title="持股模式" subtitle={plan.plan_design?.holding_model?.primary || '?'}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>选择理由: </span>
                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                  {plan.plan_design?.holding_model?.rationale}
                </span>
              </div>
              {plan.plan_design?.holding_model?.structure_description && (
                <div>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>持股结构: </span>
                  <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                    {plan.plan_design.holding_model.structure_description}
                  </span>
                </div>
              )}
            </DesignCard>

            {/* 参与范围 */}
            <DesignCard title="参与范围" subtitle={plan.plan_design?.participation?.total_persons_estimate || '?'}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>范围: </span>
                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                  {plan.plan_design?.participation?.scope_description}
                </span>
              </div>
              {plan.plan_design?.participation?.qualification?.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>资格条件:</div>
                  <ul style={{ ...ulStyle, fontSize: 13 }}>
                    {plan.plan_design.participation.qualification.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}
            </DesignCard>

            {/* 总量及分配 */}
            <DesignCard title="激励总量与个人分配" subtitle={plan.plan_design?.total_allocation?.total_amount_pct || '?'}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>个人系数公式: </span>
                <span style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, fontFamily: 'monospace' }}>
                  {plan.plan_design?.total_allocation?.individual_formula}
                </span>
              </div>
              {plan.plan_design?.total_allocation?.level_distribution?.length > 0 && (
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={thStyle}>层级</th>
                        <th style={thStyle}>占总池 %</th>
                        <th style={thStyle}>个人份额</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.plan_design.total_allocation.level_distribution.map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{d.level}</td>
                          <td style={{ ...tdStyle, color: BRAND, fontWeight: 600 }}>{d.percent}</td>
                          <td style={tdStyle}>{d.individual_share}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DesignCard>

            {/* 授予与生效 */}
            <DesignCard title="授予与生效" subtitle={plan.plan_design?.grant_vesting?.total_period || '?'}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>授予频率: </span>
                  <span style={{ color: '#475569' }}>{plan.plan_design?.grant_vesting?.grant_frequency}</span>
                </div>
                <div>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>锁定期: </span>
                  <span style={{ color: '#475569' }}>{plan.plan_design?.grant_vesting?.lock_period}</span>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>解锁节奏: </span>
                  <span style={{ color: '#475569' }}>{plan.plan_design?.grant_vesting?.vesting_schedule}</span>
                </div>
              </div>
            </DesignCard>

            {/* 业绩链接 */}
            <DesignCard title="业绩链接机制" subtitle={`${plan.plan_design?.performance_link?.metrics?.length || 0} 个指标`}>
              {plan.plan_design?.performance_link?.metrics?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 4 }}>指标 + 权重:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {plan.plan_design.performance_link.metrics.map((m, i) => (
                      <span key={i} style={{
                        padding: '3px 10px', borderRadius: 999, fontSize: 12,
                        background: BRAND_TINT, color: BRAND, fontWeight: 500,
                      }}>{m}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 1.6 }}>
                    {plan.plan_design.performance_link.weight_distribution}
                  </div>
                </div>
              )}
              {plan.plan_design?.performance_link?.performance_completion_table?.length > 0 && (
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
                        <th style={thStyle}>业绩完成率</th>
                        <th style={thStyle}>生效比例</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.plan_design.performance_link.performance_completion_table.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ ...tdStyle, fontWeight: 600 }}>{c.completion_range}</td>
                          <td style={{ ...tdStyle, color: BRAND, fontWeight: 600 }}>{c.vesting_pct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DesignCard>

            {/* 特殊情况 */}
            <DesignCard title="特殊情况处理" subtitle={`${plan.plan_design?.special_cases?.length || 0} 种场景`}>
              {plan.plan_design?.special_cases?.length > 0 && (
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                  overflow: 'hidden',
                }}>
                  {plan.plan_design.special_cases.map((c, i) => (
                    <div key={i} style={{
                      padding: '10px 14px',
                      borderBottom: i < plan.plan_design.special_cases.length - 1 ? '1px solid #E2E8F0' : 'none',
                      display: 'flex', gap: 12,
                    }}>
                      <div style={{
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: '#fff', color: '#475569', whiteSpace: 'nowrap',
                        alignSelf: 'flex-start', minWidth: 110, textAlign: 'center',
                      }}>
                        {c.scenario}
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                        {c.handling}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DesignCard>
          </div>
        </Section>

        {/* 4. 个人激励测算 */}
        {plan.individual_simulation?.length > 0 && (
          <Section title="④ 个人激励测算示例" subtitle="按典型角色的多年价值预估">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14,
            }}>
              {plan.individual_simulation.map((sim, i) => (
                <SimulationCard key={i} sim={sim} />
              ))}
            </div>
          </Section>
        )}

        {/* 5. 风险提示 */}
        {plan.risks?.length > 0 && (
          <Section title="⑤ 风险提示" subtitle="法律 / 税务 / 监管 / 财务 / 员工 5 大类">
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12,
            }}>
              {plan.risks.map((r, i) => (
                <div key={i} style={{
                  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                  padding: '14px 16px', borderLeft: '3px solid #DC2626',
                }}>
                  <div style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: '#FEF2F2', color: '#DC2626',
                    fontSize: 11, fontWeight: 600, marginBottom: 8,
                  }}>
                    ⚠ {r.category}
                  </div>
                  <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.7, marginBottom: 6 }}>
                    {r.risk}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>应对建议: </span>
                    {r.mitigation}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 6. 后续动作清单 */}
        {plan.next_steps?.length > 0 && (
          <Section title="⑥ 后续动作清单" subtitle="法务 / 财务 / 工商 / 税务 / HR 5 大方向, 含 P0/P1/P2 优先级">
            <div style={{
              background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ ...thStyle, width: 55 }}>优先级</th>
                    <th style={{ ...thStyle, width: 80 }}>领域</th>
                    <th style={thStyle}>具体动作</th>
                    <th style={{ ...thStyle, width: 110 }}>时间</th>
                    <th style={{ ...thStyle, width: 130 }}>责任人</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.next_steps.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                      <td style={tdStyle}>
                        <PriorityBadge priority={s.priority} />
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: '#F1F5F9', color: '#475569',
                        }}>
                          {s.area}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: '#0F172A' }}>{s.action}</td>
                      <td style={{ ...tdStyle, color: BRAND, fontWeight: 600 }}>{s.expected_timeline}</td>
                      <td style={tdStyle}>{s.responsible_role || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        )}

        {/* 底部 */}
        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 11, color: '#94A3B8', textAlign: 'center',
        }}>
          基于 LTI 工具 (WTW / Korn Ferry 长期激励方法论) 自动生成 ·
          {plan.generated_at && ` 生成于 ${new Date(plan.generated_at).toLocaleString('zh-CN')}`}
          {plan.model_used && ` · ${plan.model_used}`}
          <br />
          这份方案是起点级别的设计参考, 落地需配合专业律师 / 财税顾问深化.
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================
function PrimaryToolCard({ tool }: { tool: LtiToolRecommendation }) {
  return (
    <div style={{
      background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{
          padding: '4px 12px', borderRadius: 6, background: BRAND, color: '#fff',
          fontSize: 12, fontWeight: 700,
        }}>
          主推荐 ⭐
        </div>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: '#0F172A' }}>
          {tool.tool_cn}
        </div>
        <div style={{
          padding: '4px 14px', borderRadius: 999,
          background: BRAND_TINT, color: BRAND,
          fontSize: 13, fontWeight: 700,
        }}>
          匹配度 {tool.fit_score}%
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 14 }}>
        {tool.reason}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {tool.pros?.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: '#059669', fontWeight: 700,
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              ✓ 优点
            </div>
            <ul style={{ ...ulStyle, fontSize: 13 }}>
              {tool.pros.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}
        {tool.cons?.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, color: '#D97706', fontWeight: 700,
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3,
            }}>
              ⚠ 挑战
            </div>
            <ul style={{ ...ulStyle, fontSize: 13 }}>
              {tool.cons.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>
      {tool.applicable_factors && tool.applicable_factors.length > 0 && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: '1px solid #F1F5F9',
        }}>
          <div style={{
            fontSize: 11, color: '#64748B', fontWeight: 600,
            marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3,
          }}>
            支持因素
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tool.applicable_factors.map((f, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11,
                background: '#F1F5F9', color: '#475569',
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SecondaryToolCard({ tool }: { tool: LtiToolRecommendation }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
          {tool.tool_cn}
        </div>
        <div style={{
          padding: '2px 8px', borderRadius: 999,
          background: '#F1F5F9', color: '#64748B',
          fontSize: 11, fontWeight: 600,
        }}>
          {tool.fit_score}%
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
        {tool.reason}
      </div>
    </div>
  );
}

function DesignCard({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '16px 22px', borderLeft: `3px solid ${BRAND}`,
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            padding: '2px 10px', borderRadius: 4,
            background: BRAND_TINT, color: BRAND,
            fontSize: 12, fontWeight: 600,
          }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function SimulationCard({ sim }: { sim: import('../api/client').LtiIndividualSim }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
        {sim.role}
      </div>

      {/* 输入参数 */}
      {sim.scenario_input?.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>
            输入参数:
          </div>
          <div style={{
            background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6,
            padding: '8px 12px',
          }}>
            {sim.scenario_input.map((f, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '3px 0', fontSize: 12,
              }}>
                <span style={{ color: '#64748B' }}>{f.factor}</span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 逐年价值 */}
      {sim.year_by_year_value?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 6 }}>
            逐年价值:
          </div>
          <div style={{
            background: BRAND_TINT, border: `1px solid ${BRAND}33`, borderRadius: 6,
            overflow: 'hidden',
          }}>
            {sim.year_by_year_value.map((y, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                borderBottom: i < sim.year_by_year_value.length - 1 ? '1px solid #fff' : 'none',
                display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12,
              }}>
                <span style={{
                  color: BRAND, fontWeight: 700, minWidth: 70,
                }}>{y.year}</span>
                <span style={{ color: '#0F172A', fontWeight: 600, minWidth: 90 }}>
                  {y.vested_amount}
                </span>
                {y.explanation && (
                  <span style={{ color: '#64748B', fontSize: 11, lineHeight: 1.4 }}>
                    {y.explanation}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 总价值预估 */}
      <div style={{
        padding: '8px 12px', background: '#fff', border: `1px solid ${BRAND}`,
        borderRadius: 6, textAlign: 'center',
      }}>
        <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
          总价值预估:
        </span>
        <span style={{
          marginLeft: 8, fontSize: 14, color: BRAND, fontWeight: 700,
        }}>
          {sim.total_value_estimate}
        </span>
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
