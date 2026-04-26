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
import { checkValidation, type ValidationIssue, type ValidationLevel } from './hayValidation';

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

// 严重程度优先级 — 同一因子被多条规则命中时取最高严重度
const SEVERITY_RANK: Record<ValidationLevel, number> = { attention: 1, warn: 2, error: 3 };

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
  match_score: number | null;
  isCurrent: boolean;
  isRecommended: boolean;     // 第一个候选 = Sparky 推荐
  // 三个维度的 Hay Level — UI 在分数旁展示 + PS×KH 关系校验
  // 老数据可能为空,checkValidation 内部会跳过该校验
  kh_level: number | null;
  ps_level: number | null;
  ps_percentage: number | null;
  acc_level: number | null;
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
  const lastViolationKeyRef = useRef<string>('');

  const editable = isCurrent;
  const cardLabel = `方案 ${String.fromCharCode(65 + index)}`;

  // 跑 Hay 校验 — 用 Excel 试算表 (T2.Validation) 里的全套规则
  // (KH 内部 / PS 内部 / PS×KH 关系 / ACC 内部 / 跨维度上限)
  // 每次 render 都跑,候选卡也展示自己的合规情况
  const issues: ValidationIssue[] = checkValidation(
    card.factors,
    card.kh_level ?? null,
    card.ps_percentage ?? null,
  );
  const factorSeverity = aggregateSeverityByFactor(issues);

  // 当前采用的卡 + 命中 warn/error 时,推送 Sparky 消息 (attention 太多,只染色不打扰)
  // 同一组违反不重复发,避免 Sparky 刷屏
  if (isCurrent && onSparkyMessage) {
    const noisyIssues = issues.filter(i => i.level !== 'attention');
    if (noisyIssues.length > 0) {
      const key = noisyIssues.map(i => i.rule + ':' + i.message).sort().join('|');
      if (key !== lastViolationKeyRef.current) {
        lastViolationKeyRef.current = key;
        const text = formatIssuesForSparky(noisyIssues);
        // setTimeout 0 — 避免在 render 里直接调 setState
        setTimeout(() => onSparkyMessage(text), 0);
      }
    } else {
      lastViolationKeyRef.current = '';
    }
  }

  // 实时档位变化:不论是否违反规则,都调后端更新 job.factors 让分数实时刷新
  // (Sparky 只起提醒作用,最终选择权在用户)
  const handleFactorChange = async (factor: string, newValue: string) => {
    const newFactors = { ...card.factors, [factor]: newValue };
    setSaving(true);
    const updated = await tryUpdateFactorsWithRetry(job.id, newFactors);
    setSaving(false);
    if (updated) {
      onUpdated(updated);
    } else {
      onSparkyMessage?.(
        '刚才的档位调整没保存上 — 后端可能正在冷启动或网络抖动,已经自动重试一次仍然失败。等 30 秒后再改一次试试。'
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
            level={dim === 'KH' ? card.kh_level : dim === 'PS' ? card.ps_level : card.acc_level}
            factorKeys={FACTORS_BY_DIM[dim]}
            originalFactors={card.factors}
            factorSeverity={factorSeverity}
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
function DimensionRow({ dim, score, level, factorKeys, originalFactors, factorSeverity, editable, onChange, isFirst }: {
  dim: 'KH' | 'PS' | 'ACC';
  score: number;
  level: number | null;
  factorKeys: readonly string[];
  originalFactors: Record<string, string>;
  factorSeverity: Map<string, ValidationLevel>;
  editable: boolean;
  onChange: (factor: string, value: string) => void;
  isFirst: boolean;
}) {
  const color = dim === 'KH' ? KH_COLOR : dim === 'PS' ? PS_COLOR : ACC_COLOR;
  const fullName = DIMENSION_LABELS[dim];
  const levelTip = level != null
    ? `Hay ${dim} Level ${level} — Short Profile (A1/A2/L/P3 等) 由 KH/PS/ACC 三个 Level 之间的差距决定,所以同一职级下不同 Level 组合会得到不同的画像。`
    : '';

  return (
    <div style={{
      paddingTop: isFirst ? 0 : 14,
      borderTop: isFirst ? 'none' : '1px dashed #E2E8F0',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: '#94A3B8' }} title={fullName}>{fullName}</span>
        <span style={{ fontSize: 22, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 12, color: '#94A3B8' }}>分</span>
        {level != null && (
          <span
            title={levelTip}
            style={{
              fontSize: 11, color: '#64748B',
              padding: '2px 8px', borderRadius: 10,
              background: '#F1F5F9', marginLeft: 4,
              cursor: 'help', fontWeight: 500,
              borderBottom: '1px dotted #CBD5E1',
            }}
          >
            Lv {level}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {factorKeys.map(k => (
          <FactorRow
            key={k}
            factorKey={k}
            value={originalFactors[k] || ''}
            severity={factorSeverity.get(k) ?? null}
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
function FactorRow({ factorKey, value, severity, editable, onChange }: {
  factorKey: string;
  value: string;
  severity: ValidationLevel | null;
  editable: boolean;
  onChange: (v: string) => void;
}) {
  const def = getLevelDefinition(factorKey, value);
  const adjacent = getAdjacentDefinitions(factorKey, value);
  const label = FACTOR_LABELS[factorKey] || factorKey;
  const [showAdjacent, setShowAdjacent] = useState(false);
  const sty = severityStyle(severity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1, fontSize: 13, color: '#0F172A', lineHeight: 1.4 }} title={label}>
          {label}
          {severity && (
            <span style={{
              marginLeft: 6, padding: '1px 6px', borderRadius: 3,
              background: sty.badgeBg, color: sty.badgeFg, fontSize: 10, fontWeight: 600,
            }}
            title={sty.tip}
            >
              {sty.badgeLabel}
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
                border: `1px solid ${severity ? sty.borderColor : '#E2E8F0'}`, borderRadius: 4,
                background: severity ? sty.bgColor : '#fff',
                color: severity ? sty.fgColor : '#0F172A',
                fontFamily: 'inherit', minWidth: 76, cursor: 'pointer',
                outline: severity ? `2px solid ${sty.outlineColor}` : 'none',
              }}
            >
              {(FACTOR_OPTIONS[factorKey] || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <span style={{
              display: 'inline-block', padding: '5px 12px', fontSize: 13,
              background: severity ? sty.bgColor : '#F1F5F9', borderRadius: 4,
              fontFamily: 'ui-monospace, monospace',
              color: severity ? sty.fgColor : '#475569',
              minWidth: 56, textAlign: 'center',
              border: severity ? `1px solid ${sty.borderColor}` : '1px solid transparent',
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

/**
 * Hay Short Profile 的中文释义。
 *
 * Profile 由 KH/PS/ACC 三个 Level 的差距决定 — P 系列(KH 占主)/L 平衡 /
 * A 系列(ACC 占主),数字越大代表偏离平衡越远。措辞围绕"专业判断 vs
 * 承担责任"光谱,不再讲'管理 / 专业 / 战略 三权重'(那个分法不准)。
 */
const PROFILE_DESCRIPTIONS: Record<string, string> = {
  P4: '极端专业型 — 价值几乎完全来自专业深度,基本不承担决策责任',
  P3: '深度专业型 — 主要靠专业能力产出价值,少量协调',
  P2: '专业型 — 以专业判断为主要价值来源,有少量决策影响',
  P1: '偏专业型 — 专业能力为主,但已开始承担一些责任',
  L:  '均衡型 — 专业判断和承担责任旗鼓相当',
  A1: '偏承担责任型 — 责任为主,但仍有较强的专业判断成分',
  A2: '承担责任型 — 以决策影响为主要价值,依赖经验判断',
  A3: '高度承担责任型 — 偏战略决策,跨业务 / 跨职能影响',
  A4: '极端责任型 — 几乎完全靠决策影响,不再依赖具体专业能力',
};

function profileTooltip(profile: string): string {
  return PROFILE_DESCRIPTIONS[profile] || `Hay Short Profile: ${profile}`;
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
// Hay 校验工具:把 ValidationIssue[] 转成 (因子→严重度) Map + Sparky 文案
// ============================================================================

/** 同一因子被多条规则命中时,取最高严重度 (error > warn > attention) */
function aggregateSeverityByFactor(issues: ValidationIssue[]): Map<string, ValidationLevel> {
  const out = new Map<string, ValidationLevel>();
  for (const issue of issues) {
    for (const f of issue.factors) {
      const prev = out.get(f);
      if (!prev || SEVERITY_RANK[issue.level] > SEVERITY_RANK[prev]) {
        out.set(f, issue.level);
      }
    }
  }
  return out;
}

/**
 * 把若干 issues 汇总成一段 Sparky 提醒文案。
 *
 * 用 SparkyPanel 的 **xxx** 块级 markdown 把"提醒"渲染成 brand-orange 色的标题块,
 * 起到 highlight 作用。后面的具体规则不再加"分数仍按你选的档位计算..."的尾巴
 * — 用户提过这句太啰嗦,提醒有 highlight 已经够明显。
 */
function formatIssuesForSparky(issues: ValidationIssue[]): string {
  // error 摆前面 (违反硬约束),warn 在后 (Hay 不推荐组合)
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_RANK[b.level] - SEVERITY_RANK[a.level],
  );
  if (sorted.length === 1) {
    return `**提醒**\n${sorted[0].message}`;
  }
  const lines = sorted.map(i => '· ' + i.message);
  return `**提醒**\n${lines.join('\n')}`;
}

/** ValidationLevel → 一组 UI 颜色配置 */
function severityStyle(level: ValidationLevel | null): {
  borderColor: string; bgColor: string; fgColor: string;
  outlineColor: string; badgeBg: string; badgeFg: string;
  badgeLabel: string; tip: string;
} {
  if (level === 'error') {
    return {
      borderColor: '#EF4444', bgColor: '#FEF2F2', fgColor: '#B91C1C',
      outlineColor: 'rgba(239,68,68,0.15)',
      badgeBg: '#FEE2E2', badgeFg: '#B91C1C',
      badgeLabel: '违反 Hay 上限',
      tip: '违反 Hay 跨维度上限关系 (PK ≥ TE ≥ FTA) — 分数仍按当前档位计算,仅作提醒',
    };
  }
  if (level === 'warn') {
    return {
      borderColor: '#F59E0B', bgColor: '#FFFBEB', fgColor: '#92400E',
      outlineColor: 'rgba(245,158,11,0.15)',
      badgeBg: '#FEF3C7', badgeFg: '#92400E',
      badgeLabel: '不符 Hay 规则',
      tip: '跟 Hay 标准矩阵的常见组合不一致 — 分数仍按当前档位计算,仅作提醒',
    };
  }
  // attention = 轻提醒,只染色不打扰用户
  return {
    borderColor: '#0EA5E9', bgColor: '#F0F9FF', fgColor: '#0369A1',
    outlineColor: 'rgba(14,165,233,0.15)',
    badgeBg: '#E0F2FE', badgeFg: '#0369A1',
    badgeLabel: '组合较少见',
    tip: '这套档位组合在 Hay 实务中相对少见,但合规',
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
    match_score: job.result?.match_score ?? null,
    isCurrent: true,
    isRecommended: false,
    kh_level: job.result?.kh_level ?? null,
    ps_level: job.result?.ps_level ?? null,
    ps_percentage: job.result?.ps_percentage ?? null,
    acc_level: job.result?.acc_level ?? null,
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
      match_score: candidate.match_score,
      isCurrent: false,
      isRecommended: originalIdx === 0,
      kh_level: candidate.kh_level ?? null,
      ps_level: candidate.ps_level ?? null,
      ps_percentage: candidate.ps_percentage ?? null,
      acc_level: candidate.acc_level ?? null,
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

function factorsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  return FACTOR_KEYS.every(k => a[k] === b[k]);
}
