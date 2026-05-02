/**
 * 员工敬业度调研 - Stage 2: 方法论屏 (Method)
 *
 * 5 节 PPT 风格的方法论解读:
 *   1. Double E 双因素模型
 *   2. 4 类员工 2x2 矩阵
 *   3. 14 维度框架
 *   4. 员工状态研究 100 年演化 (为什么是 Double E 不是满意度)
 *   5. 样本量 + 数据可信度
 *
 * 设计:
 *   - 左侧 Sparky 面板: 5 段解读, 用户点 "下一节 →" 推进
 *   - 右侧 Workspace: 5 张可视化卡片同时呈现, 当前节高亮 + 自动滚动
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  DoubleEModelDiagram,
  DoubleEMatrix,
  FourteenDimensionsCard,
  EngagementEvolutionCard,
  SampleSizeGuideCard,
} from './components/OdVisuals';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onNext: () => void;
  onBack: () => void;
  onSkipToDiagnosis?: () => void;
}

type SectionId = 'double_e' | 'matrix' | 'dimensions' | 'evolution' | 'sample';

interface Section {
  id: SectionId;
  title: string;
  narration: string;
}

const SECTIONS: Section[] = [
  {
    id: 'double_e',
    title: '① Double E 双因素模型',
    narration: `KF 在 2007 年之后定义的员工状态衡量标准是 **Double E**:

- **员工敬业度 (Engagement)** — "我想做" — 决定员工是否愿意承诺并主动奉献
- **组织支持度 (Enablement)** — "我能做" — 决定员工能否在岗位上发挥潜能
- 二者相乘 = **员工效能 (Engaged Performance™)**, 这才是预测公司业绩的真正指标

只看一端不够 — 员工愿意付出但缺资源, 一样产生不了效能; 员工有资源但不愿意, 也是浪费。Double E 的诊断能力就在于"两端同时量化"。`,
  },
  {
    id: 'matrix',
    title: '② 4 类员工 2×2 矩阵',
    narration: `把每个员工根据"敬业度 + 支持度"两个轴打分, 落到 4 个象限:

- **高效** (双高, 55-65%) — 公司核心, 要保留扩大
- **受挫** (高敬业 + 低支持, 10-15%) — **诊断最值得关注的群体**, 想做事但缺资源 / 流程, 解决他们就能大幅提升整体效能
- **漠然** (低敬业 + 高支持, 10-15%) — 可能岗位错配 / 价值观不匹配
- **低效** (双低, 15-20%) — 突破障碍 / 离开组织

铭曦的报告会自动把每位答卷员工分类, 输出 4 类员工占比 + 部门差异。`,
  },
  {
    id: 'dimensions',
    title: '③ 14 维度框架',
    narration: `Double E 衡量的不只是"是否敬业", 还要看**敬业的驱动因素**和**支持的驱动因素** — 这就是 14 维度框架:

- **6 个敬业度驱动**: 清晰的方向 / 对领导信心 / 客户聚焦 / 尊重认可 / 发展机会 / 薪酬福利
- **6 个支持度驱动**: 绩效管理 / 授权 / 资源 / 培训 / 合作 / 工作架构
- **2 个综合维度**: 员工敬业度 (5 题) + 组织支持度 (4 题)

总共 **40 道标准题 / 5 级 Likert**, 这是 KF 全球用了 20+ 年的标准问卷。每题都有 **中国全行业** 和 **全球高绩效组织** 双基准。`,
  },
  {
    id: 'evolution',
    title: '④ 为什么是 Double E 而不是满意度',
    narration: `**满意度调查跟敬业度调查是完全不同的两件事**:

员工状态研究 100 年的演化, 从 1920s 的"员工士气"到今天的"员工效能", 早已超越了"员工开心吗"这种表层问题。

- 满意度只测**情绪** ("我开心吗") — 但开心不等于会努力
- 敬业度测的是**承诺 + 主动** ("我愿意为公司付出多少额外努力") — 这才跟绩效相关
- 员工效能 = 敬业度 + 支持度 — 这是 KF 在 2007 年之后的核心洞察

**所以如果你只是想做"员工满意度调查", Double E 是大材小用; 如果你真的想知道"组织能不能跑起来", Double E 是当前最好的方法论。**`,
  },
  {
    id: 'sample',
    title: '⑤ 样本量 + 数据可信度',
    narration: `调研的有效性取决于**回收数 vs 公司规模**的比例。铭曦的回收门槛是 **max(20, 公司人数 × 30%)**:

- < 50 人: 至少 20 份
- 50-1000 人: 至少 30%
- 1000+ 人: 至少 500 份

**为什么有门槛?** 数据样本不足时, 任何一个部门或一个序列的"赞同比"都会被几个人的极端答案带偏 — 这种统计就没诊断价值。

**铭曦的硬约束**: 回收数没到门槛, 就不允许生成诊断报告。这是为了保证报告里写的每一个百分比、每一个 Top 3, 都站得住脚。

**到这里方法论讲完了。点 "进入背景采集 →" 我会问你 2 个简单问题, 然后启动调研。**`,
  },
];

export default function OdMethod({ onNext, onBack, onSkipToDiagnosis }: Props) {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    double_e: null, matrix: null, dimensions: null, evolution: null, sample: null,
  });

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const first = SECTIONS[0];
    setMessages([
      { role: 'user', text: '继续, 看方法论' },
      { id: nextMsgId(), role: 'bot', text: introMessage() },
      { id: nextMsgId(), role: 'bot', text: `${first.title}\n\n${first.narration}` },
    ]);
  }, []);

  const goSection = (idx: number) => {
    if (idx < 0 || idx >= SECTIONS.length) return;
    const section = SECTIONS[idx];
    setActiveIdx(idx);

    setMessages(prev => [
      ...prev,
      { role: 'user', text: `下一节 — ${section.title.replace(/^[①②③④⑤]\s*/, '')}` },
      { id: nextMsgId(), role: 'bot', text: `${section.title}\n\n${section.narration}` },
    ]);

    setTimeout(() => {
      const el = sectionRefs.current[section.id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleUserMsg = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, {
      id: nextMsgId(), role: 'bot',
      text: '方法论这屏是单向铺垫,暂不展开对话 — 用底部"下一节 →"翻页, 或点"进入背景采集 →"开始, 我们到访谈环节再细聊。',
    }]);
    return true;
  };

  const isLast = activeIdx === SECTIONS.length - 1;

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden',
    }}>
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={null}
          visible={true}
          onClose={() => {}}
          onNonChatSend={handleUserMsg}
          embedded={true}
        />
        <div style={{
          flexShrink: 0, padding: '12px 24px',
          borderTop: '1px solid #E2E8F0', background: '#FAFAFA',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <button
            onClick={() => goSection(activeIdx - 1)}
            disabled={activeIdx === 0}
            style={{
              ...secondaryBtn,
              opacity: activeIdx === 0 ? 0.4 : 1,
              cursor: activeIdx === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← 上一节
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            {SECTIONS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goSection(idx)}
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  border: 'none',
                  background: idx === activeIdx ? BRAND : (idx < activeIdx ? '#16A34A' : '#E2E8F0'),
                  color: idx <= activeIdx ? '#fff' : '#94A3B8',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {idx < activeIdx ? '✓' : idx + 1}
              </button>
            ))}
          </div>

          {isLast ? (
            <button onClick={onNext} style={primaryBtn}>进入背景采集 →</button>
          ) : (
            <button onClick={() => goSection(activeIdx + 1)} style={primaryBtn}>下一节 →</button>
          )}
        </div>
      </div>

      <Workspace
        mode="wide"
        title="员工敬业度调研方法论"
        subtitle="边讲边画 — 左侧 Sparky 解读, 右侧画布同步呈现"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              onClick={onBack}
              style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              ← 回到破题
            </span>
            {onSkipToDiagnosis && (
              <span
                onClick={onSkipToDiagnosis}
                style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                看上一版报告
              </span>
            )}
            <button onClick={onNext} style={primaryBtn}>跳到背景采集 →</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {SECTIONS.map((section, idx) => (
            <div
              key={section.id}
              ref={(el) => { sectionRefs.current[section.id] = el; }}
              style={{
                position: 'relative',
                outline: idx === activeIdx ? `2px solid ${BRAND}` : 'none',
                outlineOffset: 4,
                borderRadius: 14,
                transition: 'outline 0.2s',
              }}
            >
              {idx === activeIdx && (
                <div style={{
                  position: 'absolute', top: -10, left: 12,
                  fontSize: 10, fontWeight: 600, color: BRAND, background: BRAND_TINT,
                  padding: '2px 8px', borderRadius: 10, border: `1px solid ${BRAND}33`,
                  zIndex: 1,
                }}>
                  Sparky 正在讲这一节
                </div>
              )}
              {section.id === 'double_e' && <DoubleEModelDiagram />}
              {section.id === 'matrix' && <DoubleEMatrix />}
              {section.id === 'dimensions' && <FourteenDimensionsCard />}
              {section.id === 'evolution' && <EngagementEvolutionCard />}
              {section.id === 'sample' && <SampleSizeGuideCard />}
            </div>
          ))}
        </div>
      </Workspace>
    </div>
  );
}

function introMessage(): string {
  return `好的, 现在我用 5 张图把员工敬业度调研的方法论给你过一遍 — 大概 3-5 分钟。

每张图都对应右侧画布的一张卡片, 我说到哪一节, 右边对应卡片就高亮。

底下"下一节 →"按钮翻页, 也可以直接点中间的圆点跳到任意一节。讲完会自动出现"进入背景采集 →"按钮。

我们开始第一节 —`;
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};

const secondaryBtn: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 6,
  border: '1px solid #E2E8F0', background: '#fff',
  color: '#475569', fontSize: 13, fontWeight: 500,
};
