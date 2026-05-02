/**
 * 员工敬业度调研 - Stage 1: 破题屏 (Frame)
 *
 * 目的: 在用户启动调研之前, 用 30 秒-1 分钟搞清楚 3 件事:
 *   1. 员工敬业度调研是什么 (定义)
 *   2. 什么时候适合 / 不适合做这件事 (场景自检)
 *   3. 调研结束你能拿到什么 (交付物)
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import { EesScenarioFitCard, EesDeliverablesCard } from './components/OdVisuals';

const BRAND = '#D85A30';

const FRAME_WELCOME = `你好,我是 Sparky,铭曦的员工敬业度调研顾问。

在我们启动调研之前,花 1 分钟把"为什么要做员工敬业度调研"讲清楚。

**员工敬业度调研是什么**

参考 Korn Ferry / Hay Group 的 **Double E 标准方法论** (Engagement + Enablement, 员工敬业度 + 组织支持度), 用 **40 道题 / 14 维度 / 5 级量表** 的匿名问卷, 量化测出员工"想做"和"能做"两个维度的现状, 识别公司在 14 个驱动维度上的优势和短板。

它**不是**满意度调查 — 满意度只测情绪, 敬业度测的是"承诺 + 主动奉献"; 它也**不是**绩效管理 — 这是组织级的体检, 不是给个体打分。

**右侧画布有两张图:**
- 上图: 什么时候适合 / 不适合做员工敬业度调研 (对照看自己是否需要)
- 下图: 调研结束你能拿到的 5 类产出 (参考 KF 实战交付物)

**看完之后, 点右上角 "进入方法论 →" 继续。**`;

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
        title="为什么要做员工敬业度调研"
        subtitle="花 1 分钟看完, 比直接启动调研值得"
        headerExtra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              onClick={onSkipToInterview}
              style={{ fontSize: 12, color: '#94A3B8', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              跳过两步, 直接背景采集
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
          <EesScenarioFitCard />
          <EesDeliverablesCard />
        </div>
      </Workspace>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '8px 18px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500,
};
