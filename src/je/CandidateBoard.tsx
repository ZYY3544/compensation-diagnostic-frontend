/**
 * 岗位详情右侧工作台主内容：候选方案卡片（垂直堆叠）。
 *
 * 设计要点：
 *  - 每张候选卡：顶部三数据 (Hay 职级 / 总分 / Short Profile) 横排 +
 *    下方三个维度上下堆叠，每个维度的因子带档位定义常驻显示
 *  - 当前采用的卡可改下拉，改完立即调后端 → 实时刷新分数 / 职级 / Short Profile
 *  - 前端约束链校验 (PK ≥ TE ≥ FTA 紧邻)：违反时标红下拉 + 通过 onSparkyMessage
 *    通知父组件让 Sparky 在 chat 里发提示，不调后端
 *  - 每张卡底部都有"采用此方案"按钮（当前采用的 disabled 显示"已采用"），
 *    点击 → 弹 Modal 提示已录入岗位库
 *  - 第一张卡 (engine 给的最优) 永远显示 "Sparky 推荐方案"徽章；
 *    当前采用的卡显示"当前采用"徽章；两者可叠加
 */
import { useRef, useState } from 'react';
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

// 标签格式："中文（英文原名）"
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

const DIMENSION_LABELS: Record<'KH' | 'PS' | 'ACC', string> = {
  KH: '知识技能（Know How）',
  PS: '解决问题（Problem Solving）',
  ACC: '职责（Accountability）',
};

// 列内顺序: KH 用 PK→MK→Comm；PS 反过来 TE 在上、TC 在下；ACC 用 FTA→Mag→NoI
const FACTORS_BY_DIM = {
  KH: ['practical_knowledge', 'managerial_knowledge', 'communication'],
  PS: ['thinking_environment', 'thinking_challenge'],
  ACC: ['freedom_to_act', 'magnitude', 'nature_of_impact'],
};

// PK / TE / FTA 用同一序列做约束链紧邻校验
const ALL_LEVELS = [
  'A-', 'A', 'A+', 'B-', 'B', 'B+', 'C-', 'C', 'C+',
  'D-', 'D', 'D+', 'E-', 'E', 'E+', 'F-', 'F', 'F+',
  'G-', 'G', 'G+', 'H-', 'H', 'H+', 'I-', 'I', 'I+',
];

interface Props {
  job: JeJob;
  onUpdated: (j: JeJob) => void;
  /** 约束链违反时通知父组件，让 Sparky 在 chat 里发提示 */
  onSparkyMessage?: (text: string) => void;
  /**
   * 用户点"采用此方案"成功后回调。父组件可以用来跳转到图谱视图等。
   * 默认行为：CandidateBoard 自己弹一个 Modal 提示"已录入岗位库"。
   */
  onApplied?: (cardLabel: string) => void;
  /** 提供"看职级图谱"快捷动作 — 弹窗里点"看职级图谱"会调这个 */
  onGoToMatrix?: () => void;
}

export default function CandidateBoard({ job, onUpdated, onSparkyMessage, onApplied, onGoToMatrix }: Props) {
  const candidates = job.result?.candidates || [];
  const currentFactors = job.factors || {};
  const cards = useMemo_buildCards(currentFactors, candidates, job);

  const [appliedModal, setAppliedModal] = useState<string | null>(null);

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
          onSparkyMessage={onSparkyMessage}
          onApplied={(label) => {
            onApplied?.(label);
            setAppliedModal(label);
          }}
        />
      ))}

      {appliedModal && (
        <ApplySuccessModal
          cardLabel={appliedModal}
          onClose={() => setAppliedModal(null)}
          onGoToMatrix={onGoToMatrix}
        />
      )}
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

function CandidateCard({ job, card, index, isCurrent, isRecommended, onUpdated, onSparkyMessage, onApplied }: {
  job: JeJob;
  card: CardData;
  index: number;
  isCurrent: boolean;
  isRecommended: boolean;
  onUpdated: (j: JeJob) => void;
  onSparkyMessage?: (text: string) => void;
  onApplied?: (cardLabel: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [invalidFactors, setInvalidFactors] = useState<Set<string>>(new Set());
  const lastViolationKeyRef = useRef<string>('');

  const editable = isCurrent;
  const cardLabel = `方案 ${String.fromCharCode(65 + index)}`;

  // 实时档位变化：约束链校验仅做提醒 — 不阻塞用户的修改。
  // 违反约束链时: 标红 + Sparky 提示 + 仍然调后端更新分数（让用户看到改后的代价）
  // 通过约束链时: 清掉红色提示 + 调后端更新分数
  // 这样符合"Sparky 给建议，最终决定权在用户"的产品定位。
  const handleFactorChange = async (factor: string, newValue: string) => {
    const newFactors = { ...card.factors, [factor]: newValue };
    const check = checkConstraintChain(newFactors);
    setInvalidFactors(check.violations);

    if (check.violations.size > 0) {
      // 同一种违反不重复发提醒
      const key = Array.from(check.violations).sort().join('|') + ':' + check.message;
      if (key !== lastViolationKeyRef.current) {
        lastViolationKeyRef.current = key;
        onSparkyMessage?.(check.message || '档位组合违反 Hay 约束链');
      }
    } else {
      lastViolationKeyRef.current = '';
    }

    // 不论是否违反约束链，都调后端更新 job.factors 让分数实时刷新。
    // Sparky 只起提醒作用，最终选择权在用户。
    // 网络抖动 / Render 冷启动会偶发 fetch 失败 → 自动重试一次再决定要不要打扰用户
    setSaving(true);
    const updated = await tryUpdateFactorsWithRetry(job.id, newFactors);
    setSaving(false);
    if (updated) {
      onUpdated(updated);
    } else {
      onSparkyMessage?.(
        '刚才的档位调整没保存上 — 后端可能正在冷启动或网络抖动，已经自动重试一次仍然失败。等 30 秒后再改一次试试。'
      );
    }
  };

  // 采用此方案：调后端把 job 的 factors 切成本卡的 factors，弹成功 modal
  // 同样加自动重试（网络抖动时不打扰用户）
  const handleApply = async () => {
    setSaving(true);
    const updated = await tryUpdateFactorsWithRetry(job.id, card.factors);
    setSaving(false);
    if (updated) {
      onUpdated(updated);
      onApplied?.(cardLabel);
    } else {
      onSparkyMessage?.(
        `${cardLabel} 没采用上 — 后端可能正在冷启动或网络抖动，已经自动重试一次仍然失败。等 30 秒后再点一次试试。`
      );
    }
  };

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isCurrent ? BRAND : '#E2E8F0'}`,
      borderRadius: 12, padding: 22,
      boxShadow: isCurrent ? `0 0 0 2px ${BRAND_TINT}` : 'none',
      position: 'relative',
    }}>
      {/* 顶部：方案名 + 三个核心数据 + 徽章 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 8 }}>
            {cardLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, flexWrap: 'wrap' }}>
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
          {/* 不再显示"当前采用"徽章 — 用户必须主动点"采用此方案"才表达决定，
              Sparky 只给推荐建议，最终决定权在用户。 */}
          {isRecommended && <Badge color={BRAND} bg={BRAND_TINT} label="Sparky 推荐方案" />}
        </div>
      </div>

      {/* 三个维度上下堆叠 */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 16,
        background: '#FAFBFC', border: '1px solid #F1F5F9', borderRadius: 8,
        padding: 18,
      }}>
        {(['KH', 'PS', 'ACC'] as const).map((dim, idx) => (
          <DimensionRow
            key={dim}
            dim={dim}
            score={dim === 'KH' ? card.kh_score : dim === 'PS' ? card.ps_score : card.acc_score}
            factorKeys={FACTORS_BY_DIM[dim]}
            originalFactors={card.factors}
            invalidFactors={invalidFactors}
            editable={editable}
            onChange={handleFactorChange}
            isFirst={idx === 0}
          />
        ))}
      </div>

      {/* 底部：所有卡都有"采用此方案"按钮 — 用户主动决定哪个方案入库。
          Sparky 只给推荐建议，不替用户做决定。 */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>
          {editable
            ? '改任一档位会实时刷新分数（不调 LLM，毫秒级）'
            : '只读 — 点"采用此方案"切换到这个方案后即可编辑'}
        </span>
        <button
          onClick={handleApply}
          disabled={saving}
          style={{ ...primaryBtn, padding: '8px 18px', fontSize: 13 }}
        >
          {saving ? '应用中…' : '采用此方案'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// 维度行
// ============================================================================
function DimensionRow({ dim, score, factorKeys, originalFactors, invalidFactors, editable, onChange, isFirst }: {
  dim: 'KH' | 'PS' | 'ACC';
  score: number;
  factorKeys: readonly string[];
  originalFactors: Record<string, string>;
  invalidFactors: Set<string>;
  editable: boolean;
  onChange: (factor: string, value: string) => void;
  isFirst: boolean;
}) {
  const color = dim === 'KH' ? KH_COLOR : dim === 'PS' ? PS_COLOR : ACC_COLOR;
  const fullName = DIMENSION_LABELS[dim];

  return (
    <div style={{
      paddingTop: isFirst ? 0 : 14,
      borderTop: isFirst ? 'none' : '1px dashed #E2E8F0',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#94A3B8' }} title={fullName}>{fullName}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>分</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {factorKeys.map(k => (
          <FactorRow
            key={k}
            factorKey={k}
            value={originalFactors[k] || ''}
            invalid={invalidFactors.has(k)}
            editable={editable}
            onChange={v => onChange(k, v)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 单个因子行
// ============================================================================
function FactorRow({ factorKey, value, invalid, editable, onChange }: {
  factorKey: string;
  value: string;
  invalid: boolean;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const def = getLevelDefinition(factorKey, value);
  const adjacent = getAdjacentDefinitions(factorKey, value);
  const label = FACTOR_LABELS[factorKey] || factorKey;
  const [showAdjacent, setShowAdjacent] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, fontSize: 13, color: '#0F172A', lineHeight: 1.4 }} title={label}>
          {label}
          {invalid && (
            <span style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 3,
              background: '#FEF3C7', color: '#92400E', fontSize: 10, fontWeight: 600,
            }}
            title="跟 Hay 标准约束链不一致 — 分数仍按当前档位计算，仅作提醒"
            >
              不符 Hay 规则
            </span>
          )}
        </span>
        <button
          onClick={() => setShowAdjacent(s => !s)}
          title={showAdjacent ? '收起相邻档对比' : '对比上下相邻档位'}
          style={{
            flexShrink: 0,
            width: 20, height: 20, borderRadius: '50%',
            border: showAdjacent ? `1px solid ${BRAND}` : '1px solid #E2E8F0',
            padding: 0,
            background: showAdjacent ? BRAND : '#fff',
            color: showAdjacent ? '#fff' : '#94A3B8',
            fontSize: 11, fontFamily: 'serif', fontStyle: 'italic',
            cursor: 'pointer', lineHeight: '18px',
          }}
        >i</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flexShrink: 0 }}>
          {editable ? (
            <select
              value={value}
              onChange={e => onChange(e.target.value)}
              style={{
                padding: '5px 12px', fontSize: 13,
                border: `1px solid ${invalid ? '#F59E0B' : '#E2E8F0'}`, borderRadius: 4,
                background: invalid ? '#FFFBEB' : '#fff',
                color: invalid ? '#92400E' : '#0F172A',
                fontFamily: 'inherit', minWidth: 76, cursor: 'pointer',
                outline: invalid ? '2px solid rgba(245,158,11,0.15)' : 'none',
              }}
            >
              {(FACTOR_OPTIONS[factorKey] || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <span style={{
              display: 'inline-block', padding: '5px 12px', fontSize: 13,
              background: '#F1F5F9', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace', color: '#475569',
              minWidth: 56, textAlign: 'center',
            }}>{value}</span>
          )}
        </div>
        {def && (
          <div style={{ flex: 1, fontSize: 12, lineHeight: 1.65, paddingTop: 5, color: '#64748B' }}>
            {def.description}
          </div>
        )}
      </div>

      {showAdjacent && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 88, marginTop: 2 }}>
          {(['prev', 'next'] as const).map(slot => {
            const d = adjacent[slot];
            if (!d) return null;
            return (
              <div key={slot} style={{
                padding: '6px 10px',
                background: '#F8FAFC',
                borderLeft: '2px solid #CBD5E1',
                borderRadius: 3,
                fontSize: 12, lineHeight: 1.5,
              }}>
                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                  {slot === 'prev' ? '上一档' : '下一档'}：
                </span>
                <span style={{ color: '#64748B', marginLeft: 4 }}>{d.description}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 顶部三数据：横排 inline "label：value"
// ============================================================================
function InlineStat({ label, value, tooltip }: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, fontSize: 14 }}>
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
      padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: inverted ? bg : bg,
      color: inverted ? color : color,
    }}>
      {label}
    </span>
  );
}

// ============================================================================
// 采用成功 Modal
// ============================================================================
function ApplySuccessModal({ cardLabel, onClose, onGoToMatrix }: {
  cardLabel: string;
  onClose: () => void;
  onGoToMatrix?: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: 28,
        width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(15, 23, 42, 0.2)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
          {cardLabel} 已采用
        </div>
        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 20 }}>
          该岗位的因子档位、总分、Hay 职级和 Short Profile 都已经更新到岗位库。
          {onGoToMatrix && (
            <>
              <br />
              你可以点上方的「职级图谱」按钮，看这个岗位在矩阵图里的最新位置。
            </>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>关闭</button>
          {onGoToMatrix && (
            <button
              onClick={() => { onGoToMatrix(); onClose(); }}
              style={primaryBtn}
            >
              看职级图谱 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 后端调用带自动重试 — Render 免费档冷启动/网络抖动时会偶发 fetch 失败
// 第一次失败静默等 1.5s 重试一次，仍失败返回 null 让调用方决定是否提示用户
// ============================================================================
async function tryUpdateFactorsWithRetry(
  jobId: string,
  factors: Record<string, string>,
): Promise<JeJob | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await jeUpdateFactors(jobId, factors);
      return res.data.job;
    } catch (e: any) {
      const reason = e?.response?.data?.error || e?.message || 'unknown';
      console.warn(`[je] update_factors attempt ${attempt + 1} failed:`, reason);
      if (attempt === 0) {
        // 第一次失败，静默等 1.5s 重试
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  return null;
}


// ============================================================================
// 约束链校验：PK ≥ TE ≥ FTA 上限关系（不要求紧邻）
// ============================================================================
function checkConstraintChain(factors: Record<string, string>): {
  violations: Set<string>;
  message: string | null;
} {
  const pk = factors.practical_knowledge;
  const te = factors.thinking_environment;
  const fta = factors.freedom_to_act;

  const pkIdx = ALL_LEVELS.indexOf(pk);
  const teIdx = ALL_LEVELS.indexOf(te);
  const ftaIdx = ALL_LEVELS.indexOf(fta);

  if (pkIdx < 0 || teIdx < 0 || ftaIdx < 0) {
    return { violations: new Set(), message: null };
  }

  const violations = new Set<string>();
  const messages: string[] = [];

  // PK ≥ TE — 只校验"上限"，不要求紧邻
  if (teIdx > pkIdx) {
    violations.add('thinking_environment');
    messages.push(`提醒：按 Hay 规则，思维环境不应该高于专业知识。当前专业知识是 ${pk}，思维环境是 ${te}。`);
  }

  // TE ≥ FTA — 只校验"上限"，不要求紧邻
  if (ftaIdx > teIdx) {
    violations.add('freedom_to_act');
    messages.push(`提醒：按 Hay 规则，行动自由度不应该高于思维环境。当前思维环境是 ${te}，行动自由度是 ${fta}。`);
  }

  return {
    violations,
    message: messages.length > 0
      ? messages.join('\n\n') + '\n\n这只是规则提醒 — 分数仍按你选的档位计算，最终方案由你决定。'
      : null,
  };
}

// ============================================================================
// 样式
// ============================================================================
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
// 候选卡片列表构造
// ============================================================================
function useMemo_buildCards(
  currentFactors: Record<string, string>,
  candidates: JeCandidate[],
  job: JeJob,
): CardData[] {
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

  // 关键: isRecommended 用"在原 candidates 数组里的索引"判断，而不是 filter 之后的索引。
  // 否则当 candidates[0]（真正的推荐）= currentFactors 被合到 currentCard，
  // candidates[1] 就成了 otherCards 第一个，会被错误标记为推荐。
  const otherCards: CardData[] = candidates
    .map((c, originalIdx) => ({ candidate: c, originalIdx }))
    .filter(({ candidate }) => !factorsEqual(candidate.factors, currentFactors))
    .map(({ candidate, originalIdx }, idx) => ({
      key: `cand-${idx}`,
      factors: candidate.factors,
      kh_score: candidate.kh_score,
      ps_score: candidate.ps_score,
      acc_score: candidate.acc_score,
      total_score: candidate.total_score,
      job_grade: candidate.job_grade,
      profile: candidate.profile,
      dominant: candidate.dominant === 'unknown' ? 'KH' : candidate.dominant,
      orientation: candidate.orientation,
      match_score: candidate.match_score,
      isCurrent: false,
      isRecommended: originalIdx === 0,
    }));

  // 同时把 isRecommended 标在 currentCard 上（如果 current factors 等于 LLM 给的最优）
  if (candidates.length > 0 && factorsEqual(candidates[0].factors, currentFactors)) {
    currentCard.isRecommended = true;
  }

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
