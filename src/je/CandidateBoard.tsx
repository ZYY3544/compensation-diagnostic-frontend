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
import { getLevelDefinition, getAdjacentDefinitions } from './hayDefinitions';

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

// 标签格式："中文（英文原名）"  — 对外不再用 PK / MK / TC 这种缩写，
// HR 用户大多看不懂英文缩写。需要查方法论的用户能看到英文原名作锚点。
const FACTOR_LABELS: Record<string, string> = {
  practical_knowledge: '专业知识（Practical Knowledge）',
  managerial_knowledge: '管理知识（Managerial Knowledge）',
  communication: '沟通（Communication）',
  thinking_challenge: '思维挑战（Thinking Challenge）',
  thinking_environment: '思维环境（Thinking Environment）',
  freedom_to_act: '行动自由度（Freedom to Act）',
  magnitude: '影响范围（Magnitude）',
  nature_of_impact: '影响性质（Nature of Impact）',
};

// 三个维度的全称（候选卡每列顶部显示）
const DIMENSION_LABELS: Record<'KH' | 'PS' | 'ACC', string> = {
  KH: '知识技能（Know How）',
  PS: '解决问题（Problem Solving）',
  ACC: '职责（Accountability）',
};

// 因子按 KH/PS/ACC 三维分组。
// 列内顺序由用户确认: KH 用 PK→MK→Comm；PS 反过来 TE 在上、TC 在下；ACC 用 FTA→Mag→NoI
const FACTORS_BY_DIM = {
  KH: ['practical_knowledge', 'managerial_knowledge', 'communication'],
  PS: ['thinking_environment', 'thinking_challenge'],
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
      {/* 顶部：方案名 + 三个核心数据（横排 inline "label：value" 格式） + 徽章 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 6 }}>
            方案 {String.fromCharCode(65 + index)}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
            <InlineStat
              label="Hay 职级"
              value={String(card.job_grade)}
              tooltip="Hay 体系的标准化岗位职级（1-27），数值越大代表岗位价值越高"
            />
            <InlineStat
              label="总分"
              value={`${card.total_score} 分`}
              tooltip="Know-How + Problem Solving + Accountability 三维分数之和"
            />
            {card.profile && (
              <InlineStat
                label="Short Profile"
                value={card.profile}
                tooltip={profileTooltip(card.profile)}
              />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isRecommended && !isCurrent && <Badge color={BRAND} bg={BRAND_TINT} label="Sparky 推荐" />}
          {isCurrent && <Badge color={BRAND} bg={BRAND} label="当前采用" inverted />}
        </div>
      </div>

      {/* 三个维度上下堆叠（不再三列横排）。每个维度顶部维度名 + 分数，
          下方该维度因子列表，因子档位的解释直接展示在下拉旁。 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 14,
        background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 8,
        padding: 16,
      }}>
        {(['KH', 'PS', 'ACC'] as const).map((dim, idx) => (
          <DimensionRow
            key={dim}
            dim={dim}
            score={dim === 'KH' ? card.kh_score : dim === 'PS' ? card.ps_score : card.acc_score}
            factorKeys={FACTORS_BY_DIM[dim]}
            draft={draft}
            originalFactors={card.factors}
            editable={editable}
            onChange={(k, v) => setDraft(prev => ({ ...prev, [k]: v }))}
            isFirst={idx === 0}
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
// 维度行：顶部维度名 + 分数；下方该维度的因子列表（每个因子一行）
// ============================================================================
function DimensionRow({ dim, score, factorKeys, draft, originalFactors, editable, onChange, isFirst }: {
  dim: 'KH' | 'PS' | 'ACC';
  score: number;
  factorKeys: readonly string[];
  draft: Record<string, string>;
  originalFactors: Record<string, string>;
  editable: boolean;
  onChange: (factor: string, value: string) => void;
  isFirst: boolean;
}) {
  const color = dim === 'KH' ? KH_COLOR : dim === 'PS' ? PS_COLOR : ACC_COLOR;
  const fullName = DIMENSION_LABELS[dim];

  return (
    <div style={{
      paddingTop: isFirst ? 0 : 12,
      borderTop: isFirst ? 'none' : '1px dashed #E2E8F0',
    }}>
      {/* 顶部：维度名 + 分数 */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontSize: 12, color: '#94A3B8' }} title={fullName}>{fullName}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>分</span>
      </div>

      {/* 因子列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {factorKeys.map(k => (
          <FactorRow
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

// 因子行：label 在上、下方左侧下拉 + 右侧档位定义（直接常驻展示，不再 hover 触发）。
// ⓘ 按钮点击切换"上一档 / 下一档"对比（相邻档定义跟当前档并列显示，方便横向对比）。
function FactorRow({ factorKey, value, originalValue, editable, onChange }: {
  factorKey: string;
  value: string;
  originalValue: string;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const def = getLevelDefinition(factorKey, value);
  const adjacent = getAdjacentDefinitions(factorKey, value);
  const dirty = value !== originalValue;
  const label = FACTOR_LABELS[factorKey] || factorKey;
  const [showAdjacent, setShowAdjacent] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* label 行 + ⓘ 按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, fontSize: 12, color: '#0F172A', lineHeight: 1.4 }} title={label}>
          {label}
        </span>
        <button
          onClick={() => setShowAdjacent(s => !s)}
          title={showAdjacent ? '收起相邻档对比' : '对比上下相邻档位'}
          style={{
            flexShrink: 0,
            width: 18, height: 18, borderRadius: '50%',
            border: showAdjacent ? `1px solid ${BRAND}` : '1px solid #E2E8F0',
            padding: 0,
            background: showAdjacent ? BRAND : '#fff',
            color: showAdjacent ? '#fff' : '#94A3B8',
            fontSize: 10, fontFamily: 'serif', fontStyle: 'italic',
            cursor: 'pointer', lineHeight: '16px',
          }}
        >i</button>
      </div>

      {/* 下拉 + 当前档定义（同一行，左下拉右定义） */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          {editable ? (
            <select
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                padding: '4px 10px', fontSize: 12,
                border: `1px solid ${dirty ? BRAND : '#E2E8F0'}`, borderRadius: 4,
                background: dirty ? BRAND_TINT : '#fff',
                fontFamily: 'inherit', minWidth: 70, cursor: 'pointer',
                color: '#0F172A',
              }}
            >
              {(FACTOR_OPTIONS[factorKey] || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <span style={{
              display: 'inline-block', padding: '4px 10px', fontSize: 12,
              background: '#F1F5F9', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace', color: '#475569',
              minWidth: 50, textAlign: 'center',
            }}>{value}</span>
          )}
        </div>
        {def && (
          <div style={{ flex: 1, fontSize: 11, lineHeight: 1.6, paddingTop: 4 }}>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>{def.level} · {def.label}</span>
            <span style={{ color: '#64748B', marginLeft: 6 }}>— {def.description}</span>
          </div>
        )}
      </div>

      {/* 相邻档对比（点 ⓘ 展开 — 只显示 prev / next，current 已经常驻） */}
      {showAdjacent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 82, marginTop: 2 }}>
          {(['prev', 'next'] as const).map(slot => {
            const d = adjacent[slot];
            if (!d) return null;
            return (
              <div key={slot} style={{
                padding: '6px 10px',
                background: '#F8FAFC',
                borderLeft: '2px solid #CBD5E1',
                borderRadius: 3,
                fontSize: 11, lineHeight: 1.5,
              }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>
                  {slot === 'prev' ? '上一档' : '下一档'}：
                </span>
                <span style={{ color: '#0F172A', fontWeight: 600 }}>{d.level} · {d.label}</span>
                <span style={{ color: '#64748B', marginLeft: 6 }}>— {d.description}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 小组件
// ============================================================================
// DominantPill (KH/PS/ACC 主导小标签) 已删除 — 跟 orientation 一起呈现时
// 语义经常冲突 (KH 主导 + 偏管理 矛盾)，让用户困惑。

// 横排 inline "label：value" 数据展示。鼠标悬停 label 显示 tooltip 解释字段含义。
// 跟之前的双行 ValueWithLabel 相比更紧凑，三个数据并排不占多大空间。
function InlineStat({ label, value, tooltip }: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 13 }}>
      <span
        title={tooltip}
        style={{
          color: '#94A3B8',
          cursor: tooltip ? 'help' : 'default',
          borderBottom: tooltip ? '1px dotted #CBD5E1' : 'none',
        }}
      >
        {label}：
      </span>
      <span style={{ color: '#0F172A', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

// Profile 含义说明（Hay 8 个 Profile 类型 + L 平衡型）
function profileTooltip(profile: string): string {
  const map: Record<string, string> = {
    'P4': '极端专家型 — 几乎完全靠专业深度产出价值，几乎不涉及决策和管理',
    'P3': '深度专家型 — 主要靠专业能力，少量协调',
    'P2': '专家型 — 偏专业，但有一定决策影响',
    'P1': '专家偏管理 — 专业能力为主，开始承担管理责任',
    'L':  '平衡型 — 专业 / 管理 / 战略权重均衡，典型的中层骨干',
    'A1': '管理偏专业 — 管理责任为主，仍依赖专业判断',
    'A2': '管理型 — 主要靠管理决策产出价值',
    'A3': '战略管理型 — 偏战略，决策范围更大',
    'A4': '极端战略型 — 完全战略层，几乎不涉及具体业务执行',
  };
  return map[profile] || `Hay 岗位画像类型: ${profile}`;
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
