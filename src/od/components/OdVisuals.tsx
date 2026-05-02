/**
 * 组织诊断 OD 工具的"方法论可视化"组件库 — 借鉴咨询公司 PPT 风格。
 *
 * 都用纯 SVG + CSS, 不依赖外部图表库 (Mermaid 渲染质量不稳定, 自定义 SVG 更可控)。
 *
 * 引用方法论文档: /Users/zy/Desktop/铭曦-组织诊断方法论.md
 *
 * 包含的图:
 *   - StrategyOrgLeaderTriangle  战略-组织-领导三角 (KF 经典框架)
 *   - FourChannelDiagram         4 渠道调研图 (访谈+问卷+资料+标杆)
 *   - FiveLayerStack             5 层诊断模型 (战略/组织/人才/薪酬绩效/文化领导力)
 *   - DoubleEMatrix              Double E 2x2 4 类员工矩阵
 *   - DiagnosticWorkflow         诊断工作流程 (信息→差距→建议)
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
// 1. 战略-组织-领导三角 (KF 经典框架)
// ============================================================
export function StrategyOrgLeaderTriangle() {
  // 三角形顶点坐标 (viewBox 400x340)
  const top = { x: 200, y: 56 };
  const left = { x: 56, y: 280 };
  const right = { x: 344, y: 280 };

  return (
    <VisualCard
      title="诊断三角框架"
      subtitle="战略 / 组织 / 领导 — KF 多年实战的核心模型"
      badge="核心模型"
    >
      <svg viewBox="0 0 400 340" style={{ width: '100%', height: 'auto' }}>
        {/* 三角形外框 */}
        <polygon
          points={`${top.x},${top.y} ${left.x},${left.y} ${right.x},${right.y}`}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        {/* 中心标签 */}
        <text x={200} y={195} textAnchor="middle" fontSize={12} fill="#94A3B8">战略落地框架</text>

        {/* 顶点: 战略 */}
        <circle cx={top.x} cy={top.y} r={42} fill={BRAND_TINT} stroke={BRAND} strokeWidth={2} />
        <text x={top.x} y={top.y - 4} textAnchor="middle" fontSize={15} fontWeight={600} fill={BRAND}>战略</text>
        <text x={top.x} y={top.y + 14} textAnchor="middle" fontSize={11} fill="#475569">上下同欲</text>

        {/* 左下: 组织 */}
        <circle cx={left.x} cy={left.y} r={42} fill="#EFF6FF" stroke="#3B82F6" strokeWidth={2} />
        <text x={left.x} y={left.y - 4} textAnchor="middle" fontSize={15} fontWeight={600} fill="#2563EB">组织</text>
        <text x={left.x} y={left.y + 14} textAnchor="middle" fontSize={11} fill="#475569">人尽其才</text>

        {/* 右下: 领导 */}
        <circle cx={right.x} cy={right.y} r={42} fill="#F0FDF4" stroke="#16A34A" strokeWidth={2} />
        <text x={right.x} y={right.y - 4} textAnchor="middle" fontSize={15} fontWeight={600} fill="#15803D">领导</text>
        <text x={right.x} y={right.y + 14} textAnchor="middle" fontSize={11} fill="#475569">领导有方</text>
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
        <MiniDef color={BRAND} label="战略" desc="战略目标与计划有效宣贯, 架构与职能清晰高效" />
        <MiniDef color="#2563EB" label="组织" desc="薪酬利出一孔, 考核赏罚有方, 选拔优胜劣汰" />
        <MiniDef color="#15803D" label="领导" desc="明确能力标准, 搭建良好组织氛围与文化" />
      </div>
    </VisualCard>
  );
}

function MiniDef({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <div style={{ fontSize: 11, lineHeight: 1.55, color: '#475569' }}>
      <span style={{ color, fontWeight: 600 }}>{label}: </span>{desc}
    </div>
  );
}

// ============================================================
// 2. 4 渠道调研图
// ============================================================
export function FourChannelDiagram() {
  return (
    <VisualCard
      title="4 大调研渠道"
      subtitle="自上而下 + 自下而上 + 由外而内, 多源印证"
      badge="信息采集"
    >
      <svg viewBox="0 0 460 270" style={{ width: '100%', height: 'auto' }}>
        {/* 中心: 组织诊断 */}
        <circle cx={230} cy={135} r={56} fill={BRAND} />
        <text x={230} y={130} textAnchor="middle" fontSize={14} fontWeight={600} fill="#fff">组织诊断</text>
        <text x={230} y={148} textAnchor="middle" fontSize={11} fill="#fff">分析诊断</text>

        {/* 4 个渠道节点 */}
        <ChannelNode x={70} y={50} title="关键人员访谈" sub="高管 + 员工代表" stroke="#2563EB" toX={230} toY={135} />
        <ChannelNode x={390} y={50} title="电子问卷调研" sub="员工层 + 统计样本" stroke="#7C3AED" toX={230} toY={135} />
        <ChannelNode x={70} y={220} title="管理资料研读" sub="制度 + 章程" stroke="#0891B2" toX={230} toY={135} />
        <ChannelNode x={390} y={220} title="领先实践研究" sub="案例 + 方法论" stroke="#16A34A" toX={230} toY={135} />
      </svg>

      <div style={{ marginTop: 12, fontSize: 11, color: '#64748B', lineHeight: 1.7 }}>
        <span style={{ fontWeight: 500, color: '#475569' }}>典型规模 (汇川案例):</span> 高管访谈 32 人次 / 员工代表 63 人次 / 问卷 632 份 / 4 大类管理资料
      </div>
    </VisualCard>
  );
}

function ChannelNode({ x, y, title, sub, stroke, toX, toY }: {
  x: number; y: number; title: string; sub: string; stroke: string; toX: number; toY: number;
}) {
  // 节点是矩形, 锚点在中心
  const w = 130;
  const h = 50;
  return (
    <g>
      {/* 连线 */}
      <line x1={x} y1={y} x2={toX} y2={toY} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 3" />
      {/* 节点矩形 */}
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={8}
            fill="#fff" stroke={stroke} strokeWidth={1.5} />
      <text x={x} y={y - 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#0F172A">{title}</text>
      <text x={x} y={y + 14} textAnchor="middle" fontSize={10} fill="#64748B">{sub}</text>
    </g>
  );
}

// ============================================================
// 3. 5 层诊断模型 (垂直堆叠)
// ============================================================
export function FiveLayerStack() {
  const layers = [
    { num: '①', label: '战略层', desc: '战略明晰度 / 战略宣贯 / 战略与执行', color: '#DC2626', tint: '#FEF2F2' },
    { num: '②', label: '组织层', desc: '架构合理性 / 管控模式 / 部门职责 / 决策机制', color: '#EA580C', tint: '#FFF7ED' },
    { num: '③', label: '人才层', desc: '岗位价值 / 职级体系 / 任职资格 / 关键岗位 / 人才盘点', color: '#CA8A04', tint: '#FEFCE8' },
    { num: '④', label: '薪酬绩效层', desc: '薪酬竞争力 / 内部公平 / 绩效管理 / 激励机制', color: '#16A34A', tint: '#F0FDF4' },
    { num: '⑤', label: '文化领导力层', desc: '文化定位 / 文化与战略匹配 / 领导力风格 / 接班人', color: '#2563EB', tint: '#EFF6FF' },
  ];

  return (
    <VisualCard
      title="5 层诊断内容"
      subtitle="从战略到执行, 从组织到个人, 系统覆盖"
      badge="诊断范围"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {layers.map(l => (
          <div key={l.num} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 16px',
            background: l.tint,
            border: `1px solid ${l.color}33`,
            borderLeft: `4px solid ${l.color}`,
            borderRadius: 8,
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: l.color, minWidth: 28 }}>{l.num}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: l.color, marginBottom: 3 }}>{l.label}</div>
              <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{l.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

// ============================================================
// 4. Double E 2x2 4 类员工矩阵
// ============================================================
export function DoubleEMatrix() {
  return (
    <VisualCard
      title="Double E 模型 + 4 类员工"
      subtitle="员工敬业度 (我想做) × 组织支持度 (我能做) → 4 类员工分布"
      badge="员工诊断"
    >
      {/* 顶部 Double E 公式条 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', background: '#F8FAFC',
        borderRadius: 8, marginBottom: 16, fontSize: 12,
      }}>
        <span style={{ fontWeight: 600, color: BRAND }}>员工敬业度</span>
        <span style={{ color: '#94A3B8' }}>(我想做)</span>
        <span style={{ color: '#94A3B8' }}>+</span>
        <span style={{ fontWeight: 600, color: '#2563EB' }}>组织支持度</span>
        <span style={{ color: '#94A3B8' }}>(我能做)</span>
        <span style={{ color: '#94A3B8' }}>=</span>
        <span style={{ fontWeight: 600, color: '#0F172A' }}>员工效能 / 敬业绩效™</span>
      </div>

      {/* 2x2 矩阵 */}
      <div style={{ position: 'relative', paddingLeft: 32, paddingBottom: 32 }}>
        {/* Y 轴标签 */}
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'center', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap',
        }}>组织支持度 →</div>

        {/* X 轴标签 */}
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: '#64748B',
        }}>员工敬业度 →</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {/* 左上: 漠然 */}
          <Quadrant
            color="#3B82F6" label="漠然的员工" pct="10-15%"
            desc="支持够, 我不敬业"
            insight="可能岗位匹配 / 价值观问题"
          />
          {/* 右上: 高效 */}
          <Quadrant
            color="#16A34A" label="高效的员工" pct="55-65%"
            desc="敬业 + 公司支持都到位"
            insight="公司核心, 要保留和扩大"
            highlight
          />
          {/* 左下: 低效 */}
          <Quadrant
            color="#DC2626" label="低效的员工" pct="15-20%"
            desc="敬业 + 支持都不到位"
            insight="突破障碍 / 离开组织"
          />
          {/* 右下: 受挫 */}
          <Quadrant
            color="#EA580C" label="受挫的员工" pct="10-15%"
            desc="想做事但缺资源 / 支持"
            insight="OD 最值得关注的群体 — 解决支持就增大效能"
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
// 5. 诊断工作流程
// ============================================================
export function DiagnosticWorkflow() {
  const steps = [
    { num: '01', title: '信息调研', desc: '4 渠道采集 (访谈/问卷/资料/标杆)', color: '#2563EB' },
    { num: '02', title: '差距分析', desc: '当前现状 vs 行业领先实践', color: BRAND },
    { num: '03', title: '优化建议', desc: '战略层 / 体系层 / 运营层 3 类建议', color: '#16A34A' },
  ];

  return (
    <VisualCard
      title="诊断工作流程"
      subtitle="信息采集 → 差距识别 → 优化方向"
      badge="工作方法"
    >
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
        {steps.map((s, idx) => (
          <div key={s.num} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{
              flex: 1, padding: '14px 12px',
              border: `1.5px solid ${s.color}`,
              borderRadius: 8, background: `${s.color}08`,
              textAlign: 'center', minHeight: 100,
              display: 'flex', flexDirection: 'column', justifyContent: 'center',
            }}>
              <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.num}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flexShrink: 0, padding: '0 6px', color: '#CBD5E1', fontSize: 18 }}>→</div>
            )}
          </div>
        ))}
      </div>
    </VisualCard>
  );
}

// ============================================================
// 6. "适合做 / 不适合做" 场景对比 (Frame 屏专用)
// ============================================================
export function ScenarioFitCard() {
  const fits = [
    { icon: '📈', text: '业务快速增长后管理跟不上' },
    { icon: '🎯', text: '战略目标巨大, 但人才能力不足' },
    { icon: '🔀', text: '新老业务融合或并购整合' },
    { icon: '🔄', text: '业务模式转型 (制造→服务等)' },
    { icon: '👤', text: '领导更迭, 新 CEO 摸底' },
  ];
  const nofits = [
    { icon: '🚫', text: '只有单一模块问题 (例: 只是薪酬不竞争)' },
    { icon: '🚫', text: '已知问题想要直接解决方案 (跳到对应工具更快)' },
    { icon: '🚫', text: '非组织级问题 (例: 个人能力 / 单点流程)' },
  ];

  return (
    <VisualCard
      title="什么时候适合做组织诊断"
      subtitle="OD 是漏斗顶端 — 诊断后再决定走哪条路"
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
// 7. 你能拿到什么 (Frame 屏专用 — 6 类产出)
// ============================================================
export function OutputDeliverablesCard() {
  const outputs = [
    { icon: '📊', title: '总体效能多维度结果', desc: '12 维度赞同比 + vs 行业基准差距' },
    { icon: '👥', title: '不同序列对比', desc: '研发 / 制造 / 营销等部门差异' },
    { icon: '🎯', title: '4 类员工分布', desc: '高效 / 漠然 / 受挫 / 低效 占比' },
    { icon: '⚠️', title: '离职风险 + 重点细分', desc: '司龄 / 年龄 / 关键岗位的留任风险' },
    { icon: '💡', title: '5 层面诊断 (现状 + 痛点)', desc: '战略 / 组织 / 人才 / 薪酬绩效 / 文化领导力' },
    { icon: '🛠', title: '优化建议 + 后续工具引导', desc: '战略层 / 体系层 / 运营层 3 类建议 + 跳转闭环' },
  ];

  return (
    <VisualCard
      title="诊断结束后, 你能拿到什么"
      subtitle="参考 KF 实战交付物 (汇川 / 致中和 / 口味王等)"
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
