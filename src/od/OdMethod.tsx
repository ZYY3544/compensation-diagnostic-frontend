/**
 * 组织诊断 - Stage 2: 方法论屏 (Method)
 *
 * 目的: 用"PPT 边讲边画"的咨询师感觉, 把 KF 方法论讲清楚:
 *   1. 战略-组织-领导三角 (核心框架)
 *   2. 4 渠道调研 (信息采集)
 *   3. 5 层诊断内容 (诊断范围)
 *   4. Double E 模型 + 4 类员工 (员工诊断核心)
 *   5. 工作流程 (信息→差距→建议)
 *
 * 设计:
 *   - 左侧 Sparky 面板: 4 段解读, 用户点 "下一节 →" 推进, Sparky 解释当前可视化
 *   - 右侧 Workspace: 5 张可视化卡片同时呈现, 当前章节高亮 + 自动滚到对应卡片
 *
 * 这就是用户问"区别于通用 agent 的差异化"想要的视觉体验。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import {
  StrategyOrgLeaderTriangle,
  FourChannelDiagram,
  FiveLayerStack,
  DoubleEMatrix,
  DiagnosticWorkflow,
} from './components/OdVisuals';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onNext: () => void;
  onBack: () => void;
  onSkipToDiagnosis?: () => void;
}

type SectionId = 'triangle' | 'channels' | 'layers' | 'doublee' | 'workflow';

interface Section {
  id: SectionId;
  title: string;
  narration: string;
}

const SECTIONS: Section[] = [
  {
    id: 'triangle',
    title: '① 诊断三角框架',
    narration: `KF 的组织诊断核心模型是**战略 / 组织 / 领导**三角。

- **战略 (上下同欲)** — 战略目标与计划要被有效宣贯, 架构和职能要清晰高效
- **组织 (人尽其才)** — 薪酬利出一孔, 考核赏罚有方, 选拔优胜劣汰
- **领导 (领导有方)** — 明确能力标准, 搭建良好组织氛围与文化

这 3 个角任何一个失衡, 战略都落不了地。诊断就是定位**到底哪个角出了问题, 出在哪里**。`,
  },
  {
    id: 'channels',
    title: '② 4 渠道调研',
    narration: `单一信息源做诊断不靠谱 — 高管讲的、员工感受的、制度写的、行业实践的, 经常对不上。所以 KF 用 **4 渠道交叉印证**:

- **关键人员访谈** — 自上而下, 高管 + 员工代表
- **电子问卷调研** — 员工层定量样本 (KF 标准 600+ 份起)
- **管理资料研读** — 现有制度 / 章程 / 流程文件
- **领先实践研究** — 行业标杆 + 方法论对照

铭曦把这 4 渠道都做到访谈 + 资料上传里了 — 一个工具内完成。`,
  },
  {
    id: 'layers',
    title: '③ 5 层诊断内容',
    narration: `从战略到执行, 完整的诊断要扫描 **5 个层面** — 任何一层有 gap 都会拖累整体。

每一层都有自己的核心议题, 比如:
- **战略层** — 战略目标是否清晰? 是否传递到一线?
- **组织层** — 架构是否匹配业务模式? 部门职责清不清?
- **人才层** — 关键岗位是否到位? 人才储备够不够?
- **薪酬绩效层** — 薪酬竞争力 / 内部公平 / 绩效结果是否真的影响晋升?
- **文化领导力层** — 文化是否支持战略? 高管领导力够不够?

你接下来的访谈, 每一层就是 1 道核心题, 我会基于你的回答深挖追问。`,
  },
  {
    id: 'doublee',
    title: '④ Double E + 4 类员工',
    narration: `这是 KF 在员工层面诊断的"招牌方法论" — **Double E**:

**员工敬业度 (我想做)** + **组织支持度 (我能做)** = **员工效能** (Engaged Performance™)

把员工按 2×2 分成 4 类:
- **高效** (双高, 55-65%) — 公司核心, 要扩大
- **受挫** (高敬业 + 低支持, 10-15%) — 想做事但缺资源, **诊断最值得关注的群体**
- **漠然** (低敬业 + 高支持, 10-15%) — 可能岗位匹配 / 价值观问题
- **低效** (双低, 15-20%) — 突破障碍 / 离开组织

KF 的标准问卷里有 12 维度 70+ 道题来衡量, 铭曦报告里也会按这个结构呈现。`,
  },
  {
    id: 'workflow',
    title: '⑤ 工作流程',
    narration: `最后, 整个诊断的工作流是 **3 步** :

1. **信息调研** — 4 渠道采集 (KF 案例平均 1-1.5 个月做完)
2. **差距分析** — 当前现状 vs 行业领先实践, 找出 gap
3. **优化建议** — 分**战略层 / 体系层 / 运营层** 3 类, 每类对应不同的后续动作

铭曦把这 3 步压缩到 1-2 周内能拿到 80% 价值的 SaaS 流程, 这是产品差异化。

**到这里, 方法论已经讲完了。点 "进入访谈 →" 我们开始 5 层访谈。**`,
  },
];

export default function OdMethod({ onNext, onBack, onSkipToDiagnosis }: Props) {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);
  const sectionRefs = useRef<Record<SectionId, HTMLDivElement | null>>({
    triangle: null, channels: null, layers: null, doublee: null, workflow: null,
  });

  // 第一段: 欢迎 + 第一节解读
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

  // 切换章节: 追加 narration + 滚到对应卡片
  const goSection = (idx: number) => {
    if (idx < 0 || idx >= SECTIONS.length) return;
    const section = SECTIONS[idx];
    setActiveIdx(idx);

    setMessages(prev => [
      ...prev,
      { role: 'user', text: `下一节 — ${section.title.replace(/^[①②③④⑤]\s*/, '')}` },
      { id: nextMsgId(), role: 'bot', text: `${section.title}\n\n${section.narration}` },
    ]);

    // 滚到对应可视化卡片
    setTimeout(() => {
      const el = sectionRefs.current[section.id];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleUserMsg = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, {
      id: nextMsgId(), role: 'bot',
      text: '方法论这屏是单向铺垫,暂不展开对话 — 用底部"下一节 →"翻页, 或点"进入访谈 →"开始 5 层访谈, 我们到访谈环节再细聊。',
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
        {/* 底部章节导航 */}
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
            <button onClick={onNext} style={primaryBtn}>进入访谈 →</button>
          ) : (
            <button onClick={() => goSection(activeIdx + 1)} style={primaryBtn}>下一节 →</button>
          )}
        </div>
      </div>

      <Workspace
        mode="wide"
        title="组织诊断方法论"
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
            <button onClick={onNext} style={primaryBtn}>跳到访谈 →</button>
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
              {section.id === 'triangle' && <StrategyOrgLeaderTriangle />}
              {section.id === 'channels' && <FourChannelDiagram />}
              {section.id === 'layers' && <FiveLayerStack />}
              {section.id === 'doublee' && <DoubleEMatrix />}
              {section.id === 'workflow' && <DiagnosticWorkflow />}
            </div>
          ))}
        </div>
      </Workspace>
    </div>
  );
}

function introMessage(): string {
  return `好的, 现在我用 5 张图把组织诊断的方法论给你过一遍 — 大概 3-5 分钟。

每张图都对应右侧画布的一张卡片, 我说到哪一节, 右边对应卡片就高亮。

底下"下一节 →"按钮翻页, 也可以直接点中间的圆点跳到任意一节。讲完会自动出现"进入访谈 →"按钮。

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
