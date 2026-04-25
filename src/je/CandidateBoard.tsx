/**
 * 岗位详情右侧工作台主内容：候选方案卡片（垂直堆叠）。
 *
 * 跟旧版的 ReasoningPanel + FactorTable 关系：
 *  - 旧版分两个 tab：评估解释（只读候选）+ 因子明细（可编辑下拉）
 *  - 新版合一：每张候选卡上方是 KH/PS/ACC 三维分数，下方是该方案的 8 因子下拉
 *  - 当前采用的卡可编辑，其他候选只读 + 提供"采用此方案"切换
 *  - LLM 推理（pk_reasoning）不在这里展示，由左侧 Sparky 对话栏接管
 *
 * 单张候选卡布局：
 *   ┌─ 方案 A · 当前采用 / Sparky 推荐 ──────────────────┐
 *   │ G12 · 213 分                                         │
 *   │ KH 主导 · 偏管理 · A1                                │
 *   │                                                       │
 *   │ ┌─ KH（128 分）─┬─ PS（38 分）─┬─ ACC（43 分）──┐    │
 *   │ │ PK [D ▼]      │ TC [3 ▼]    │ FTA [C+ ▼]    │    │
 *   │ │ MK [I ▼]      │ TE [D ▼]    │ Mag [N ▼]     │    │
 *   │ │ Comm [2 ▼]    │             │ NoI [III ▼]   │    │
 *   │ └───────────────┴─────────────┴───────────────┘    │
 *   │                                                       │
 *   │ [✓ 当前采用]    或    [采用此方案]    + (如 dirty) 重算 │
 *   └───────────────────────────────────────────────────────┘
 */
import { useEffect, useState } from 'react';
import { jeUpdateFactors, type JeJob, type JeCandidate } from '../api/client';
import { getLevelDefinition } from './hayDefinitions';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';
const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';

const FACTOR_KEYS = [
  'practical_knowledge', 'managerial_knowledge', 'communication',
  'thinking_challenge', 'thinking_environment',
  'freedom_to_act', 'magnitude', 'nature_of_impact',
] as const;

const FACTOR_OPTIONS: Record<string, string[]> = {
  practical_knowledge: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+','I-','I','I+'],
  managerial_knowledge: ['T-','T','T+','I-','I','I+','II-','II','II+','III-','III','III+','IV-','IV','IV+','V-','V','V+','VI-','VI','VI+','VII-','VII','VII+','VIII-','VIII','VIII+','IX-','IX','IX+'],
  communication: ['1-','1','1+','2-','2','2+','3-','3','3+'],
  thinking_challenge: ['1-','1','1+','2-','2','2+','3-','3','3+','4-','4','4+','5-','5','5+'],
  thinking_environment: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+'],
  freedom_to_act: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+','I-','I','I+'],
  magnitude: ['N','1-','1','1+','2-','2','2+','3-','3','3+','4-','4','4+','5-','5','5+'],
  nature_of_impact: ['I','II','III','IV','V','VI','R','C','S','P'],
};

const FACTOR_LABELS: Record<string, string> = {
  practical_knowledge: 'PK 专业知识',
  managerial_knowledge: 'MK 管理知识',
  communication: 'Comm 沟通',
  thinking_challenge: 'TC 思维挑战',
  thinking_environment: 'TE 思维环境',
  freedom_to_act: 'FTA 行动自由度',
  magnitude: 'Mag 影响范围',
  nature_of_impact: 'NoI 影响性质',
};

// 因子按 KH/PS/ACC 三维分组
const FACTORS_BY_DIM = {
  KH: ['practical_knowledge', 'managerial_knowledge', 'communication'],
  PS: ['thinking_challenge', 'thinking_environment'],
  ACC: ['freedom_to_act', 'magnitude', 'nature_of_impact'],
};

interface Props {
  job: JeJob;
  onUpdated: (j: JeJob) => void;
}

export default function CandidateBoard({ job, onUpdated }: Props) {
  const candidates = job.result?.candidates || [];
  const currentFactors = job.factors || {};

  // 把当前采用方案 + 其他候选按 (是否当前) 排序，构造卡片列表
  const cards = useMemo_buildCards(currentFactors, candidates, job);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {cards.map((card, i) => (
        <CandidateCard
          key={card.key}
          job={job}
          card={card}
          index={i}
          isCurrent={card.isCurrent}
          isRecommended={card.isRecommended}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  );
}

// ============================================================================
// 单张候选卡
// ============================================================================
interface CardData {
  key: string;
  factors: Record<string, string>;
  kh_score: number;
  ps_score: number;
  acc_score: number;
  total_score: number;
  job_grade: number;
  profile: string | null;
  dominant: 'KH' | 'PS' | 'ACC' | 'unknown';
  orientation: string;
  match_score: number | null;
  isCurrent: boolean;
  isRecommended: boolean;     // 第一个候选 = Sparky 推荐
}

function CandidateCard({ job, card, index, isCurrent, isRecommended, onUpdated }: {
  job: JeJob;
  card: CardData;
  index: number;
  isCurrent: boolean;
  isRecommended: boolean;
  onUpdated: (j: JeJob) => void;
}) {
  // dirty 状态：用户修改下拉后跟原 card.factors 不一致
  const [draft, setDraft] = useState<Record<string, string>>(card.factors);
  const [saving, setSaving] = useState(false);

  // card 变化时（比如父组件重新渲染了候选）同步 draft
  useEffect(() => { setDraft(card.factors); }, [card.key, JSON.stringify(card.factors)]);

  const dirty = FACTOR_KEYS.some(k => draft[k] !== card.factors[k]);
  const editable = isCurrent;   // 只有当前采用的卡能改下拉；其他候选只能"采用"切换

  const handleApplyOther = async () => {
    if (!confirm('采用这套候选方案？8 因子会被覆盖为该方案。')) return;
    setSaving(true);
    try {
      const res = await jeUpdateFactors(job.id, card.factors);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`应用失败：${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleRecompute = async () => {
    setSaving(true);
    try {
      const res = await jeUpdateFactors(job.id, draft);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`重算失败：${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDraft = () => setDraft(card.factors);

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isCurrent ? BRAND : '#E2E8F0'}`,
      borderRadius: 12, padding: 20,
      boxShadow: isCurrent ? `0 0 0 2px ${BRAND_TINT}` : 'none',
      position: 'relative',
    }}>
      {/* 顶部：方案名 + 徽章 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>
            方案 {String.fromCharCode(65 + index)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#0F172A' }}>
              G{card.job_grade}
            </span>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              {card.total_score} 分
            </span>
            {card.profile && <span style={{ fontSize: 11, color: '#94A3B8' }}>· {card.profile}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
            {card.dominant !== 'unknown' && <DominantPill dominant={card.dominant} />}
            {card.orientation && <span style={{ marginLeft: 6 }}>{card.orientation}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isRecommended && !isCurrent && <Badge color={BRAND} bg={BRAND_TINT} label="Sparky 推荐" />}
          {isCurrent && <Badge color={BRAND} bg={BRAND} label="当前采用" inverted />}
        </div>
      </div>

      {/* 三维分数 + 三维档位下拉 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        background: '#FAFBFC', borderRadius: 8, overflow: 'hidden',
        border: '1px solid #F1F5F9',
      }}>
        {(['KH', 'PS', 'ACC'] as const).map((dim, idx) => (
          <DimensionColumn
            key={dim}
            dim={dim}
            score={dim === 'KH' ? card.kh_score : dim === 'PS' ? card.ps_score : card.acc_score}
            factorKeys={FACTORS_BY_DIM[dim]}
            draft={draft}
            originalFactors={card.factors}
            editable={editable}
            onChange={(k, v) => setDraft(prev => ({ ...prev, [k]: v }))}
            isLast={idx === 2}
          />
        ))}
      </div>

      {/* 底部操作栏 */}
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {isCurrent ? (
          dirty ? (
            <>
              <button onClick={handleResetDraft} disabled={saving} style={ghostBtn}>取消修改</button>
              <button onClick={handleRecompute} disabled={saving} style={primaryBtn}>
                {saving ? '重算中…' : '重算并保存'}
              </button>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#94A3B8', alignSelf: 'center' }}>
              修改任一档位下拉即可触发重算（不调 LLM，毫秒级）
            </span>
          )
        ) : (
          <button onClick={handleApplyOther} disabled={saving} style={primaryBtn}>
            {saving ? '应用中…' : '采用此方案'}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 三维列：分数（顶）+ 该维度因子下拉（底）
// ============================================================================
function DimensionColumn({ dim, score, factorKeys, draft, originalFactors, editable, onChange, isLast }: {
  dim: 'KH' | 'PS' | 'ACC';
  score: number;
  factorKeys: readonly string[];
  draft: Record<string, string>;
  originalFactors: Record<string, string>;
  editable: boolean;
  onChange: (factor: string, value: string) => void;
  isLast: boolean;
}) {
  const color = dim === 'KH' ? KH_COLOR : dim === 'PS' ? PS_COLOR : ACC_COLOR;
  const fullName = dim === 'KH' ? 'Know-How' : dim === 'PS' ? 'Problem Solving' : 'Accountability';

  return (
    <div style={{
      padding: 12,
      borderRight: isLast ? 'none' : '1px solid #F1F5F9',
    }}>
      {/* 分数（顶部） */}
      <div style={{ paddingBottom: 10, borderBottom: '1px dashed #F1F5F9', marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{dim} · {fullName}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{score}</span>
          <span style={{ fontSize: 10, color: '#94A3B8' }}>分</span>
        </div>
      </div>

      {/* 因子下拉（底部） */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {factorKeys.map(k => (
          <FactorSelect
            key={k}
            factorKey={k}
            value={draft[k] || ''}
            originalValue={originalFactors[k]}
            editable={editable}
            onChange={v => onChange(k, v)}
          />
        ))}
      </div>
    </div>
  );
}

function FactorSelect({ factorKey, value, originalValue, editable, onChange }: {
  factorKey: string;
  value: string;
  originalValue: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const [hoverLevel, setHoverLevel] = useState<string | null>(null);
  const def = hoverLevel ? getLevelDefinition(factorKey, hoverLevel) : getLevelDefinition(factorKey, value);
  const dirty = value !== originalValue;
  const label = FACTOR_LABELS[factorKey] || factorKey;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#475569', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {editable ? (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            onMouseOver={e => setHoverLevel((e.target as HTMLSelectElement).value)}
            onMouseLeave={() => setHoverLevel(null)}
            title={def ? `${def.level} · ${def.label}\n${def.description}` : ''}
            style={{
              padding: '3px 6px', fontSize: 11,
              border: `1px solid ${dirty ? BRAND : '#E2E8F0'}`, borderRadius: 4,
              background: dirty ? BRAND_TINT : '#fff',
              fontFamily: 'inherit', minWidth: 56, cursor: 'pointer',
              color: '#0F172A',
            }}
          >
            {(FACTOR_OPTIONS[factorKey] || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        ) : (
          <span title={def ? `${def.level} · ${def.label}\n${def.description}` : ''} style={{
            padding: '3px 8px', fontSize: 11,
            background: '#F8FAFC', borderRadius: 4,
            fontFamily: 'ui-monospace, monospace',
            color: '#475569',
          }}>{value}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 小组件
// ============================================================================
function DominantPill({ dominant }: { dominant: 'KH' | 'PS' | 'ACC' }) {
  const color = dominant === 'KH' ? KH_COLOR : dominant === 'PS' ? PS_COLOR : ACC_COLOR;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {dominant} 主导
    </span>
  );
}

function Badge({ color, bg, label, inverted }: { color: string; bg: string; label: string; inverted?: boolean }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: inverted ? bg : bg,
      color: inverted ? '#fff' : color,
    }}>
      {label}
    </span>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, borderRadius: 6,
  border: 'none', background: BRAND, color: '#fff',
  cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, borderRadius: 6,
  border: '1px solid #E2E8F0', background: '#fff', color: '#475569',
  cursor: 'pointer',
};

// ============================================================================
// 候选卡片列表构造（不是 React hook，名字加 useMemo_ 前缀只是为了可读性 — 内部就是纯函数）
// ============================================================================
function useMemo_buildCards(
  currentFactors: Record<string, string>,
  candidates: JeCandidate[],
  job: JeJob,
): CardData[] {
  // 第一张卡：当前采用方案。用 job.result 拿分数，用 job.factors 拿档位
  const currentCard: CardData = {
    key: 'current',
    factors: { ...currentFactors },
    kh_score: job.result?.kh_score ?? 0,
    ps_score: job.result?.ps_score ?? 0,
    acc_score: job.result?.acc_score ?? 0,
    total_score: job.result?.total_score ?? 0,
    job_grade: job.result?.job_grade ?? 0,
    profile: job.result?.profile ?? null,
    dominant: pickDominant(job.result?.kh_score ?? 0, job.result?.ps_score ?? 0, job.result?.acc_score ?? 0),
    orientation: orientationFromProfile(job.result?.profile ?? null),
    match_score: job.result?.match_score ?? null,
    isCurrent: true,
    isRecommended: false,
  };

  // 其他候选：跟当前 factors 不同的才显示
  const otherCards: CardData[] = candidates
    .filter(c => !factorsEqual(c.factors, currentFactors))
    .map((c, idx) => ({
      key: `cand-${idx}`,
      factors: c.factors,
      kh_score: c.kh_score,
      ps_score: c.ps_score,
      acc_score: c.acc_score,
      total_score: c.total_score,
      job_grade: c.job_grade,
      profile: c.profile,
      dominant: c.dominant === 'unknown' ? 'KH' : c.dominant,
      orientation: c.orientation,
      match_score: c.match_score,
      isCurrent: false,
      isRecommended: idx === 0,    // candidates 数组首项 = 引擎给的 best
    }));

  return [currentCard, ...otherCards];
}

function pickDominant(kh: number, ps: number, acc: number): 'KH' | 'PS' | 'ACC' | 'unknown' {
  const total = kh + ps + acc;
  if (total === 0) return 'unknown';
  const m = Math.max(kh, ps, acc);
  if (m === kh) return 'KH';
  if (m === ps) return 'PS';
  return 'ACC';
}

function orientationFromProfile(profile: string | null): string {
  if (!profile) return '';
  if (profile.startsWith('P')) return '偏专业 / 操作型';
  if (profile.startsWith('A')) return '偏管理 / 战略型';
  if (profile === 'L') return '平衡型';
  return profile;
}

function factorsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  return FACTOR_KEYS.every(k => a[k] === b[k]);
}
