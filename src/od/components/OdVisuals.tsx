/**
 * 员工敬业度调研 (EES) 工具的"方法论可视化"组件库 — 借鉴咨询公司 PPT 风格。
 *
 * 都用纯 SVG + CSS, 不依赖外部图表库。
 *
 * 引用方法论文档: /Users/zy/Desktop/铭曦-组织诊断方法论.md (Double E 章节)
 *
 * 包含的图:
 *   - DoubleEModelDiagram         Double E 双因素模型 (Engagement + Enablement → Engaged Performance)
 *   - DoubleEMatrix               2x2 4 类员工矩阵
 *   - FourteenDimensionsCard      14 维度详解 (敬业度 6 + 支持度 6 + 综合 2)
 *   - EngagementEvolutionCard     员工状态研究的 100 年演化 (士气 → 满意度 → 敬业度 → 敬业绩效)
 *   - SampleSizeGuideCard         样本量建议 (回收门槛 + 行业基准)
 *   - EesScenarioFitCard          适合 / 不适合做敬业度调研的场景 (Frame 屏专用)
 *   - EesDeliverablesCard         调研后能拿到什么 (Frame 屏专用)
 */
import type { ReactNode } from 'react';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

// ============================================================
// 通用容器: 一张"PPT 卡片"
// ============================================================
interface CardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badge?: string;
}

export function VisualCard({ title, subtitle, children, badge }: CardProps) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      padding: '22px 24px 26px',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 3 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#64748B' }}>{subtitle}</div>}
        </div>
        {badge && (
          <span style={{
            fontSize: 11, color: BRAND, background: BRAND_TINT,
            padding: '3px 9px', borderRadius: 10, fontWeight: 500,
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================
// 1. Double E 双因素模型 (核心方法论)
// ============================================================
export function DoubleEModelDiagram() {
  return (
    <VisualCard
      title="Double E 双因素模型"
      subtitle="员工效能 = 员工敬业度 (我想做) × 组织支持度 (我能做)"
      badge="核心模型"
    >
      <svg viewBox="0 0 460 300" style={{ width: '100%', height: 'auto' }}>
        {/* 左上: 员工敬业度 */}
        <rect x={30} y={30} width={170} height={80} rx={10}
              fill={BRAND_TINT} stroke={BRAND} strokeWidth={2} />
        <text x={115} y={58} textAnchor="middle" fontSize={14} fontWeight={600} fill={BRAND}>员工敬业度</text>
        <text x={115} y={75} textAnchor="middle" fontSize={11} fill={BRAND}>Engagement</text>
        <text x={115} y={94} textAnchor="middle" fontSize={11} fill="#475569">"我想做"</text>

        {/* 右上: 组织支持度 */}
        <rect x={260} y={30} width={170} height={80} rx={10}
              fill="#EFF6FF" stroke="#2563EB" strokeWidth={2} />
        <text x={345} y={58} textAnchor="middle" fontSize={14} fontWeight={600} fill="#2563EB">组织支持度</text>
        <text x={345} y={75} textAnchor="middle" fontSize={11} fill="#2563EB">Enablement</text>
        <text x={345} y={94} textAnchor="middle" fontSize={11} fill="#475569">"我能做"</text>

        {/* 中间汇聚 */}
        <line x1={115} y1={110} x2={195} y2={155} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3" />
        <line x1={345} y1={110} x2={265} y2={155} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3" />

        {/* 中下: 员工效能 */}
        <rect x={130} y={155} width={200} height={60} rx={10}
              fill="#16A34A" stroke="#15803D" strokeWidth={2} />
        <text x={230} y={180} textAnchor="middle" fontSize={14} fontWeight={600} fill="#fff">员工效能 / 敬业绩效™</text>
        <text x={230} y={198} textAnchor="middle" fontSize={11} fill="#fff">Engaged Performance™</text>

        {/* 向下箭头 */}
        <line x1={230} y1={215} x2={230} y2={235} stroke="#94A3B8" strokeWidth={1.5} />
        <polygon points="225,232 230,242 235,232" fill="#94A3B8" />

        {/* 最下: 业绩结果 */}
        <rect x={50} y={245} width={360} height={45} rx={8}
              fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={1} />
        <text x={230} y={264} textAnchor="middle" fontSize={11} fontWeight={600} fill="#0F172A">业绩结果</text>
        <text x={230} y={280} textAnchor="middle" fontSize={10} fill="#64748B">
          卓越运营 / 客户满意 / 财务结果 / 人才吸引和保留 / 雇主品牌
        </text>
      </svg>

      <div style={{
        marginTop: 14, padding: '12px 16px', background: '#F8FAFC',
        borderRadius: 8, fontSize: 11, color: '#475569', lineHeight: 1.7,
      }}>
        <b style={{ color: '#0F172A' }}>核心洞察:</b> 仅"敬业"不够 — 员工愿意付出但缺资源/支持, 一样产生不了效能。Double E 模型量化的是"想做"和"能做"两端的健康度, 缺哪一端就补哪一端。
      </div>
    </VisualCard>
  );
}

// ============================================================
// 2. 2x2 4 类员工矩阵
// ============================================================
export function DoubleEMatrix() {
  return (
    <VisualCard
      title="4 类员工 2×2 分布"
      subtitle="员工敬业度 × 组织支持度 → 4 类员工 — 每类对应不同的管理动作"
      badge="员工诊断"
    >
      <div style={{ position: 'relative', paddingLeft: 32, paddingBottom: 32 }}>
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'center', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap',
        }}>组织支持度 →</div>
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: '#64748B',
        }}>员工敬业度 →</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Quadrant
            color="#3B82F6" label="漠然的员工" pct="10-15%"
            desc="支持够, 我不敬业"
            insight="可能岗位匹配 / 价值观问题"
          />
          <Quadrant
            color="#16A34A" label="高效的员工" pct="55-65%"
            desc="敬业 + 公司支持都到位"
            insight="公司核心, 要保留和扩大"
            highlight
          />
          <Quadrant
            color="#DC2626" label="低效的员工" pct="15-20%"
            desc="敬业 + 支持都不到位"
            insight="突破障碍 / 离开组织"
          />
          <Quadrant
            color="#EA580C" label="受挫的员工" pct="10-15%"
            desc="想做事但缺资源 / 支持"
            insight="EES 最值得关注的群体 — 解决支持就增大效能"
            highlight
          />
        </div>
      </div>
    </VisualCard>
  );
}

function Quadrant({ color, label, pct, desc, insight, highlight }: {
  color: string; label: string; pct: string; desc: string; insight: string; highlight?: boolean;
}) {
  return (
    <div style={{
      padding: '14px 16px',
      background: highlight ? `${color}11` : '#fff',
      border: `1.5px solid ${color}`,
      borderRadius: 8,
      minHeight: 110,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: 11, color: '#64748B' }}>{pct}</span>
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginBottom: 6, fontStyle: 'italic' }}>"{desc}"</div>
      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>{insight}</div>
    </div>
  );
}

// ============================================================
// 3. 14 维度详解 (敬业度 6 + 支持度 6 + 综合 2)
// ============================================================
export function FourteenDimensionsCard() {
  const groupA = {
    name: '员工敬业度 6 维度',
    sub: '"我想做" — 决定员工是否愿意承诺并主动奉献',
    color: BRAND,
    tint: BRAND_TINT,
    items: [
      '清晰和有希望的方向',
      '对领导者的信心',
      '聚焦质量和客户',
      '尊重与认可',
      '发展机会',
      '薪酬与福利',
    ],
  };
  const groupB = {
    name: '组织支持度 6 维度',
    sub: '"我能做" — 决定员工能否在岗位上发挥潜能',
    color: '#2563EB',
    tint: '#EFF6FF',
    items: [
      '绩效管理',
      '职权与授权',
      '资源',
      '培训',
      '合作',
      '工作、架构和流程',
    ],
  };

  return (
    <VisualCard
      title="14 维度框架"
      subtitle="6 个敬业度驱动 + 6 个支持度驱动 + 2 个综合 → 40 道标准题"
      badge="问卷设计"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {[groupA, groupB].map(g => (
          <div key={g.name} style={{
            background: g.tint,
            border: `1.5px solid ${g.color}33`,
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: g.color, marginBottom: 4 }}>{g.name}</div>
            <div style={{ fontSize: 10, color: '#64748B', marginBottom: 10, lineHeight: 1.5 }}>{g.sub}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {g.items.map((it, idx) => (
                <div key={it} style={{
                  padding: '6px 10px', background: '#fff',
                  border: '1px solid #E2E8F0', borderRadius: 6,
                  fontSize: 11, color: '#0F172A',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4,
                    background: g.color, color: '#fff',
                    fontSize: 10, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{idx + 1}</span>
                  {it}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, padding: '10px 14px', background: '#F8FAFC',
        borderRadius: 8, fontSize: 11, color: '#475569', lineHeight: 1.6,
      }}>
        外加 <b style={{ color: BRAND }}>员工敬业度</b> (5 道综合题) + <b style={{ color: '#2563EB' }}>组织支持度</b> (4 道综合题) 的"屋顶"维度, 共 <b>14 维度 / 40 题 / 5 级 Likert 量表</b>。
      </div>
    </VisualCard>
  );
}

// ============================================================
// 4. 员工状态研究的 100 年演化
// ============================================================
export function EngagementEvolutionCard() {
  const eras = [
    { period: '1920-30s', name: '员工士气',     desc: '士气与生产力的关联' },
    { period: '1940-60s', name: '员工满意度',   desc: '员工开心吗' },
    { period: '1970-80s', name: '员工忠诚度',   desc: '自豪感和承诺' },
    { period: '1990s+',   name: '员工敬业度',   desc: '承诺并主动奉献' },
    { period: '2007+',    name: '员工效能',     desc: '敬业度+支持度激发潜能', highlight: true },
    { period: '2012+',    name: '高绩效组织',   desc: '持续高绩效' },
  ];

  return (
    <VisualCard
      title={`为什么是 Double E 而不是"满意度调查"`}
      subtitle="员工状态研究的 100 年演化"
      badge="方法论选型"
    >
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {eras.map((e, idx) => (
          <div key={e.period} style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{
              flex: 1, padding: '12px 8px',
              border: e.highlight ? `2px solid ${BRAND}` : '1px solid #E2E8F0',
              borderRadius: 8,
              background: e.highlight ? BRAND_TINT : '#fff',
              textAlign: 'center', minHeight: 90,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{
                fontSize: 9, color: e.highlight ? BRAND : '#94A3B8',
                fontWeight: 500, marginBottom: 4,
              }}>{e.period}</div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: e.highlight ? BRAND : '#0F172A', marginBottom: 4,
              }}>{e.name}</div>
              <div style={{ fontSize: 9, color: '#64748B', lineHeight: 1.3 }}>{e.desc}</div>
            </div>
            {idx < eras.length - 1 && (
              <div style={{ flexShrink: 0, padding: '0 2px', color: '#CBD5E1', fontSize: 12 }}>→</div>
            )}
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 14, padding: '12px 14px', background: BRAND_TINT,
        borderRadius: 8, fontSize: 11, color: BRAND, lineHeight: 1.6,
      }}>
        <b>满意度只测情绪</b> ("我开心吗"), <b>敬业度测的是承诺 + 主动</b> ("我愿意为公司付出多少额外的努力"), <b>员工效能 = 敬业度 + 支持度</b> 才能真正解释绩效产出 — 这是 KF 在 2007 年之后的核心洞察。
      </div>
    </VisualCard>
  );
}

// ============================================================
// 5. 样本量建议
// ============================================================
export function SampleSizeGuideCard() {
  const samples = [
    { size: '< 50 人',     threshold: '20 份',  guideline: '小公司全员调研, 不区分部门' },
    { size: '50-200 人',   threshold: '30%',    guideline: '部门级细分有意义, Top 5 部门展示' },
    { size: '200-1000 人', threshold: '30%',    guideline: '完整 14 维度 + 部门 + 司龄 / 年龄交叉' },
    { size: '1000+ 人',    threshold: '500+',   guideline: 'KF 标准做法 — 600-1500 份起做行业对标' },
  ];

  return (
    <VisualCard
      title="样本量建议 + 回收门槛"
      subtitle="铭曦门槛: max(20, 公司人数 × 30%) — 数据足够才有诊断价值"
      badge="数据可信度"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '25%' }}>公司规模</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', width: '20%' }}>建议门槛</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569' }}>分析颗粒度</th>
          </tr>
        </thead>
        <tbody>
          {samples.map(s => (
            <tr key={s.size} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '10px 12px', color: '#0F172A', fontWeight: 500 }}>{s.size}</td>
              <td style={{ padding: '10px 12px', color: BRAND, fontWeight: 600 }}>{s.threshold}</td>
              <td style={{ padding: '10px 12px', color: '#475569' }}>{s.guideline}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </VisualCard>
  );
}

// ============================================================
// 6. "适合做 / 不适合做" 场景对比 (Frame 屏专用)
// ============================================================
export function EesScenarioFitCard() {
  const fits = [
    { icon: '📈', text: '业务高速增长, 想知道员工是否跟得上节奏' },
    { icon: '🔄', text: '业务模式转型 / 大组织调整后, 看员工接受度' },
    { icon: '👥', text: '人才流失变多, 想找出原因 (薪酬? 发展? 领导?)' },
    { icon: '📊', text: '想跟行业基准对标 — 看自己处于什么水平' },
    { icon: '🎯', text: '战略宣贯做了, 想验证一线员工到底听懂了多少' },
  ];
  const nofits = [
    { icon: '🚫', text: '只想做满意度评分 — 用更轻的工具就行' },
    { icon: '🚫', text: '想给个体打绩效分 — 不是这个工具的目的' },
    { icon: '🚫', text: '小于 20 人的小团队 — 数据样本不足, 隐私也不好保护' },
  ];

  return (
    <VisualCard
      title="什么时候适合做员工敬业度调研"
      subtitle="不是任何场景都需要 — 用对了才有价值"
      badge="选型自检"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#16A34A', marginBottom: 10 }}>✓ 适合的场景</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fits.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '8px 10px', background: '#F0FDF4',
                border: '1px solid #BBF7D0', borderRadius: 6,
                fontSize: 11, lineHeight: 1.5, color: '#14532D',
              }}>
                <span>{f.icon}</span><span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 10 }}>✗ 不适合的场景</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {nofits.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '8px 10px', background: '#FEF2F2',
                border: '1px solid #FECACA', borderRadius: 6,
                fontSize: 11, lineHeight: 1.5, color: '#7F1D1D',
              }}>
                <span>{f.icon}</span><span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </VisualCard>
  );
}

// ============================================================
// 7. 调研后能拿到什么 (Frame 屏专用 — 5 类产出)
// ============================================================
export function EesDeliverablesCard() {
  const outputs = [
    { icon: '📊', title: '总体效能多维度结果', desc: '员工敬业度 / 组织支持度 + 14 维度赞同比 + vs 双基准差距' },
    { icon: '🎯', title: '4 类员工分布', desc: '高效 / 受挫 / 漠然 / 低效 占比 — 找出"想做但缺支持"的群体' },
    { icon: '👥', title: '部门差异分析', desc: '研发 / 销售 / 行政等部门的敬业度 / 支持度 横向比较' },
    { icon: '💡', title: 'Top 3 优势 + Bottom 3 短板', desc: '哪些维度领先行业, 哪些拖后腿 — 优先补什么一目了然' },
    { icon: '🛠', title: 'AI 优化建议', desc: '基于真实数据 + 行业实践, 给出针对性改善方向' },
  ];

  return (
    <VisualCard
      title="调研结束后, 你能拿到什么"
      subtitle="参考 KF 实战交付物 (金升阳 / 喜威燃气 / 新松机器人等)"
      badge="交付物"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {outputs.map((o, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '12px 14px', background: '#F8FAFC',
            border: '1px solid #E2E8F0', borderRadius: 8,
          }}>
            <div style={{ fontSize: 18 }}>{o.icon}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 3 }}>{o.title}</div>
              <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.5 }}>{o.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}
