/**
 * Success Profile + 8 因子 + 三维分数 的只读详情视图。
 *
 * 用在两处:
 *   1. 岗位详情页 DetailLayout 的右侧抽屉(用户点"Success Profile"按钮触发)
 *   2. 后续如果有岗位库 entry 详情弹窗,也复用同一份组件
 *
 * SP 内容来自 standard library entry (hay_grade × 行业 决定),用户编辑因子
 * 不会修改 SP — SP 是"目标画像",因子是"实际评分"。如果用户调整因子让职级
 * 偏离 SP 期望,他们应该感知到差距,但不会自动改 SP 文案 (跟我们之前
 * 跟用户讨论过的"SP 与 Hay 双向同步与否"的设计是一致的)。
 */
import type { JeLibraryEntry } from '../api/client';

const BRAND = '#D85A30';
const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';

export default function SuccessProfileView({ entry }: { entry: JeLibraryEntry }) {
  const sp = entry.success_profile;
  return (
    <div style={{
      padding: '16px 18px',
      background: '#fff', borderRadius: 8,
      border: '1px solid #E2E8F0',
      fontSize: 12, color: '#475569', lineHeight: 1.7,
    }}>
      {/* 顶部:Hay 职级 / 总分 / Profile / 三维分数 */}
      <div style={{ display: 'flex', gap: 16, paddingBottom: 12, borderBottom: '1px dashed #E2E8F0', flexWrap: 'wrap' }}>
        <Stat label="Hay 职级" value={entry.hay_grade != null ? `G${entry.hay_grade}` : '—'} />
        <Stat label="总分" value={entry.total_score != null ? `${entry.total_score} 分` : '—'} />
        {entry.profile && <Stat label="Short Profile" value={entry.profile} />}
        <Stat label="KH" value={entry.kh_score != null ? `${entry.kh_score}` : '—'} color={KH_COLOR} />
        <Stat label="PS" value={entry.ps_score != null ? `${entry.ps_score}` : '—'} color={PS_COLOR} />
        <Stat label="ACC" value={entry.acc_score != null ? `${entry.acc_score}` : '—'} color={ACC_COLOR} />
      </div>

      {/* SP 主体 */}
      {sp ? (
        <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sp.purpose && (
            <Section title="岗位使命">
              <div>{sp.purpose}</div>
            </Section>
          )}
          {sp.accountabilities && sp.accountabilities.length > 0 && (
            <Section title="核心职责">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {sp.accountabilities.map((a, i) => <li key={i} style={{ marginBottom: 3 }}>{a}</li>)}
              </ul>
            </Section>
          )}
          {sp.requirements && (
            <Section title="任职要求">
              <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '4px 12px' }}>
                {sp.requirements.education && (<><span style={labelCellStyle}>学历</span><span>{sp.requirements.education}</span></>)}
                {sp.requirements.experience && (<><span style={labelCellStyle}>经验</span><span>{sp.requirements.experience}</span></>)}
                {sp.requirements.professional_skills && sp.requirements.professional_skills.length > 0 && (
                  <><span style={labelCellStyle}>关键技能</span>
                    <span>{sp.requirements.professional_skills.join(' / ')}</span>
                  </>
                )}
              </div>
            </Section>
          )}
          {sp.competencies && (
            <Section title="能力要求 (5 维)">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, paddingTop: 4 }}>
                {(['专业力', '管理力', '合作力', '思辨力', '创新力'] as const).map(k => {
                  const c = sp.competencies?.[k];
                  if (!c) return null;
                  return <CompetencyBar key={k} name={k} level={c.required_level} />;
                })}
              </div>
            </Section>
          )}
          {sp.kpis && sp.kpis.length > 0 && (
            <Section title="绩效指标">
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {sp.kpis.map((k, i) => <li key={i} style={{ marginBottom: 3 }}>{k}</li>)}
              </ul>
            </Section>
          )}
        </div>
      ) : (
        <div style={{ paddingTop: 12, color: '#94A3B8', fontStyle: 'italic' }}>
          这个岗位还没有 Success Profile 内容。
        </div>
      )}

      {/* 8 因子档位 (只读 — 真正编辑在 CandidateBoard 里做) */}
      {entry.factors && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed #E2E8F0' }}>
          <Section title="标准 8 因子档位">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: '4px 12px', fontSize: 11,
            }}>
              <FactorCell label="PK" value={entry.factors.practical_knowledge} />
              <FactorCell label="MK" value={entry.factors.managerial_knowledge} />
              <FactorCell label="Comm" value={entry.factors.communication} />
              <FactorCell label="TC" value={entry.factors.thinking_challenge} />
              <FactorCell label="TE" value={entry.factors.thinking_environment} />
              <FactorCell label="FTA" value={entry.factors.freedom_to_act} />
              <FactorCell label="Mag" value={entry.factors.magnitude} />
              <FactorCell label="NoI" value={entry.factors.nature_of_impact} />
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6, lineHeight: 1.5 }}>
              这是从标准库带来的基线档位 — 实际编辑在右侧候选方案卡上,改了之后职级会跟着重算。
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 10, color: '#94A3B8' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color || '#0F172A' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}

function CompetencyBar({ name, level }: { name: string; level: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#475569', minWidth: 36 }}>{name}</span>
      <div style={{ display: 'flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} style={{
            width: 8, height: 14, borderRadius: 2,
            background: i <= level ? BRAND : '#E2E8F0',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: '#64748B', fontWeight: 500 }}>{level}</span>
    </div>
  );
}

function FactorCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span style={{ color: '#94A3B8' }}>{label}</span>
      <span style={{ color: '#0F172A', fontFamily: 'ui-monospace, monospace', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

const labelCellStyle: React.CSSProperties = {
  color: '#94A3B8', fontSize: 11,
};
