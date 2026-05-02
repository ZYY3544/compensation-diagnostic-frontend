/**
 * 组织诊断 - Stage 1: 破题屏 (Frame)
 *
 * 目的: 在用户进入访谈之前, 用 30 秒-1 分钟搞清楚 3 件事:
 *   1. 组织诊断到底诊断什么 (定义)
 *   2. 什么时候适合 / 不适合做组织诊断 (场景自检)
 *   3. 诊断结束你能拿到什么 (交付物)
 *
 * 设计原则: 保持轻 — 左侧 Sparky 一段简短解读, 右侧 Workspace 视觉卡片承载主信息。
 * 不写长篇文字 — 视觉传达 + 几个关键 bullet。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import { ScenarioFitCard, OutputDeliverablesCard } from './components/OdVisuals';

const BRAND = '#D85A30';

const FRAME_WELCOME = `你好,我是 Sparky,铭曦的组织诊断顾问。

在我们开始访谈之前,先花 1 分钟把"为什么要做组织诊断"讲清楚 — 咨询公司在交付前一定会做这一步,所以铭曦也保留这个习惯。

**组织诊断是什么**

参考 Korn Ferry / Hay Group 的方法论,从战略 / 组织 / 人才 / 薪酬绩效 / 文化领导力 5 个层面,**多角度、系统性地评估**你的组织和 HR 现状,**识别现状与领先实践的差距**。

它**不是**给标准答案,也**不是**单纯做 HR 模块审查 — 是发现问题的"体检",而不是开药方。

**右侧画布有两张图:**
- 上图: 什么时候适合 / 不适合做组织诊断 (你可以对照看自己是否需要)
- 下图: 诊断结束你能拿到的 6 类产出 (参考 KF 实战交付物)

**看完之后,可以点右上角 "进入方法论 →" 继续, 或者直接 "进入访谈" 跳过这两步。**`;

interface Props {
  onNext: () => void;
  onSkipToInterview: () => void;
  onSkipToDiagnosis?: () => void;
}

export default function OdFrame({ onNext, onSkipToInterview, onSkipToDiagnosis }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setMessages([
      { role: 'user', text: '我想做一次组织诊断' },
      { id: nextMsgId(), role: 'bot', text: FRAME_WELCOME },
    ]);
  }, []);

  const handleUserMsg = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    setMessages(prev => [...prev, {
      id: nextMsgId(), role: 'bot',
      text: '这一屏只是破题铺垫,我们暂时不展开对话 — 看完右侧画布后,点"进入方法论 →"或"进入访谈"继续。后面的访谈环节我会跟你深聊。',
    }]);
    return true;
  };

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
      </div>

      <Workspace
        mode="wide"
        title="为什么要做组织诊断"
        subtitle="花 1 分钟看完, 比直接进访谈值得"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              onClick={onSkipToInterview}
              style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              跳过两步, 直接访谈
            </span>
            {onSkipToDiagnosis && (
              <span
                onClick={onSkipToDiagnosis}
                style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                看上一版报告
              </span>
            )}
            <button onClick={onNext} style={primaryBtn}>进入方法论 →</button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ScenarioFitCard />
          <OutputDeliverablesCard />
        </div>
      </Workspace>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};
