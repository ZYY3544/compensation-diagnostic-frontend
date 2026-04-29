/**
 * 战略解码地图展示视图。
 *
 * 包括 7 个区块:
 *   1. 一句话战略表述 (头部)
 *   2. 三大杠杆 (3 个 stat 卡片)
 *   3. 部门翻译 (每个部门的 critical outcomes + KPIs)
 *   4. 关键岗位 (按 priority 分组)
 *   5. 能力建设优先级 (1y / 3y 两栏)
 *   6. 季度路线图 (Q1-Q4)
 *   7. 一致性检查 (6 项 ✓ / ⚠ / ✗ status)
 *
 * 不接 SparkyPanel — 这是只读展示页,左侧 Sparky 由 SdApp 框架统一提供。
 */
import type { SdProfile, SdDecoding } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  profile: SdProfile;
  decoding: SdDecoding;
  onRestart?: () => void;     // 重新开始访谈 (覆盖 profile 和 decoding)
  onRegenerate?: () => void;  // 基于现 profile 重新生成 decoding
}

export default function SdDecodingView({ profile, decoding, onRestart, onRegenerate }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      padding: '32px 48px 64px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 顶部行动按钮 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
          {onRegenerate && (
            <button onClick={onRegenerate} style={secondaryBtn}>重新生成解码</button>
          )}
          {onRestart && (
            <button onClick={onRestart} style={secondaryBtn}>重新做战略澄清</button>
          )}
        </div>

        {/* 1. 一句话战略表述 */}
        <Section title="战略表述">
          <div style={{
            background: '#fff', border: `2px solid ${BRAND}`, borderRadius: 12,
            padding: '24px 28px', fontSize: 16, lineHeight: 1.8, color: '#0F172A',
            fontWeight: 500,
          }}>
            {decoding.strategy_statement}
          </div>
        </Section>

        {/* 2. 三大杠杆 */}
        <Section title="三大杠杆">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
          }}>
            {decoding.three_levers?.map((lever, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
                padding: '18px 20px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6, background: BRAND,
                    color: '#fff', fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A' }}>
                    {lever.name}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
                  {lever.rationale}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 3. 部门翻译 */}
        <Section title="部门翻译" subtitle="未来 1 年各部门要交付的 critical outcomes 与对应 KPI">
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ ...thStyle, width: 110 }}>部门</th>
                  <th style={thStyle}>Critical Outcomes</th>
                  <th style={{ ...thStyle, width: '38%' }}>KPIs</th>
                </tr>
              </thead>
              <tbody>
                {decoding.department_translations?.map((dept, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F1F5F9', verticalAlign: 'top' }}>
                    <td style={{ ...tdStyle, fontWeight: 600, color: '#0F172A' }}>
                      {dept.department}
                    </td>
                    <td style={tdStyle}>
                      <ul style={ulStyle}>
                        {dept.critical_outcomes?.map((o, j) => <li key={j}>{o}</li>)}
                      </ul>
                    </td>
                    <td style={tdStyle}>
                      <ul style={ulStyle}>
                        {dept.kpis?.map((k, j) => <li key={j}>{k}</li>)}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* 4. 关键岗位 */}
        <Section title="关键岗位" subtitle="为执行战略需要重点配置 / 招聘的岗位,按优先级分组">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12,
          }}>
            {decoding.critical_roles?.map((role, i) => (
              <div key={i} style={{
                background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
                padding: '14px 16px',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A' }}>
                    {role.role}
                  </div>
                  <PriorityBadge priority={role.priority} />
                </div>
                <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>
                  {role.why_critical}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 5. 能力建设 */}
        <Section title="能力建设优先级">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          }}>
            <div style={capabilityBox('1y')}>
              <div style={capabilityLabel}>1 年内必须建立</div>
              <ul style={{ ...ulStyle, marginTop: 8 }}>
                {decoding.capability_priorities?.['1y']?.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
            <div style={capabilityBox('3y')}>
              <div style={capabilityLabel}>3 年内要建立 (现在就要投资)</div>
              <ul style={{ ...ulStyle, marginTop: 8 }}>
                {decoding.capability_priorities?.['3y']?.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          </div>
        </Section>

        {/* 6. 季度路线图 */}
        <Section title="季度路线图">
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
                  {q.milestones?.map((m, j) => <li key={j}>{m}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* 7. 一致性检查 */}
        <Section title="一致性检查" subtitle="基于 Korn Ferry 钻石模型 6 项战略质量标准">
          <div style={{
            background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
            overflow: 'hidden',
          }}>
            {decoding.consistency_check?.map((c, i) => (
              <div key={i} style={{
                padding: '14px 18px',
                borderBottom: i < (decoding.consistency_check.length - 1) ? '1px solid #F1F5F9' : 'none',
                display: 'flex', alignItems: 'flex-start', gap: 14,
              }}>
                <StatusBadge status={c.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                    {c.criterion}
                  </div>
                  <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
                    {c.note}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 底部信息条 */}
        <div style={{
          marginTop: 32, padding: '14px 18px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 11, color: '#94A3B8', textAlign: 'center',
        }}>
          基于战略澄清访谈输入 (5 维度) 自动生成 ·
          {decoding.generated_at && ` 生成于 ${new Date(decoding.generated_at).toLocaleString('zh-CN')}`}
          {decoding.model_used && ` · ${decoding.model_used}`}
        </div>
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

function PriorityBadge({ priority }: { priority: string }) {
  const isImmediate = priority.includes('立即');
  const isShort = priority.includes('6');
  const color = isImmediate ? '#DC2626' : isShort ? '#D97706' : '#0EA5E9';
  const bg = isImmediate ? '#FEF2F2' : isShort ? '#FFFBEB' : '#F0F9FF';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: bg, color, whiteSpace: 'nowrap',
    }}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPass = status.includes('✓') || status.includes('通过');
  const isWarn = status.includes('⚠') || status.includes('待补');
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

const thStyle: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'left',
  fontSize: 11, fontWeight: 600, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: 0.3,
};

const tdStyle: React.CSSProperties = {
  padding: '14px 16px', fontSize: 13, color: '#475569', lineHeight: 1.7,
};

const ulStyle: React.CSSProperties = {
  margin: 0, paddingLeft: 18, fontSize: 13, color: '#475569', lineHeight: 1.8,
};

const capabilityLabel: React.CSSProperties = {
  fontSize: 12, color: '#64748B', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: 0.3,
};

const capabilityBox = (variant: '1y' | '3y'): React.CSSProperties => ({
  background: variant === '1y' ? BRAND_TINT : '#F8FAFC',
  border: `1px solid ${variant === '1y' ? `${BRAND}33` : '#E2E8F0'}`,
  borderRadius: 12,
  padding: '18px 20px',
});

const secondaryBtn: React.CSSProperties = {
  padding: '7px 16px', fontSize: 12, fontWeight: 500,
  background: '#fff', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 6,
  cursor: 'pointer',
};
