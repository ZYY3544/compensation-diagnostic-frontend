/**
 * JE 入口选择页（默认进入 JE 时看到的第一屏）。
 *
 * 设计依据：3 个收敛后的高频场景
 *  A. 评一个岗位       — HRBP / HR 临时咨询 / 招聘定级 / 晋升评估
 *  B. 我有岗位清单要批量评 — HRD 年度调薪 / 组织诊断 / 并购整合
 *  C. 从零建立职级体系 — 新公司 / 转型期 / 全面重构（v2 完整访谈流程）
 *
 * 交互：
 *  - 左侧 Sparky 流式开场介绍 + 输入框（可直接对话表达需求）
 *  - 右侧 Workspace 三张大卡片，点击直达对应路径
 *  - chat 输入"评一个销售经理" / "上传清单" / "建立体系" 等关键词，
 *    Sparky 自动分发到对应路径
 *
 * 为什么不直接在 chat 用 chip：
 *  右侧大卡片承载更多说明文字（"什么时候用 / 大概多久"），用户做完一次后
 *  会形成对三条路径的认知；纯 chat chip 容易选了不知道选了什么。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import Workspace from '../components/layout/Workspace';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export type EntryPath = 'single' | 'list' | 'system';

interface Props {
  onChoose: (path: EntryPath) => void;
}

export default function JeEntryView({ onChoose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    setMessages([{ role: 'user', text: '我想用 JE 评估岗位价值' }]);
    const replyId = nextMsgId();
    setTimeout(() => {
      setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
      const intro = [
        '你好，我是 Sparky，岗位价值评估助手。',
        '',
        '今天主要想做什么？右边有三个常见的入口，对应不同的工作场景。',
        '',
        '也可以直接告诉我你想做什么 — 比如"评一下销售经理"、"我有 30 个岗位的清单"、"从零建立职级体系"。',
      ].join('\n');
      streamText(intro, (t) => {
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
      });
    }, 200);
  }, []);

  // 用户在输入框直接表达需求 → 关键词分发
  const handleUserInput = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    const path = inferPath(text);
    if (path) {
      const replyId = nextMsgId();
      const reply = path === 'single' ? '好，开评估表单。粘贴 JD 或简短描述都行。'
        : path === 'list' ? '好，打开批量上传。把 Excel 拖进去就行。'
        : '好，进入访谈流程，先了解一下你们公司基本情况。';
      setTimeout(() => {
        setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
        streamText(reply, (t) => {
          setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
        }, () => {
          setTimeout(() => onChoose(path), 400);
        });
      }, 100);
    } else {
      const replyId = nextMsgId();
      setTimeout(() => {
        setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
        streamText(
          '我没听明白你想走哪条路径。点右边的卡片直接选，或者再说一遍 — "评一个岗位" / "上传我的清单" / "建立体系"。',
          (t) => setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m)),
        );
      }, 100);
    }
    return true;
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左：Sparky 对话区 */}
      <div style={{
        flex: 1, minWidth: 0, height: '100%',
        background: '#fff', borderRight: '1px solid #E2E8F0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={null}
          visible={true}
          onClose={() => {}}
          onNonChatSend={handleUserInput}
          embedded={true}
        />
      </div>

      {/* 右：三个路径卡片 */}
      <Workspace mode="wide" title="选择入口" subtitle="对应三个常见的工作场景">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PathCard
            label="评一个岗位"
            duration="< 1 分钟"
            scenes="招聘定级 / 晋升评估 / 临时咨询"
            description="粘贴一份 JD 或简短描述，立刻得到 8 因子档位 + Hay 标准职级 + AI 推理过程。适合 HRBP 日常使用。"
            cta="开始单评"
            onClick={() => onChoose('single')}
          />
          <PathCard
            label="我有岗位清单要批量评"
            duration="10–30 分钟"
            scenes="年度调薪 / 组织诊断 / 并购整合"
            description="上传 Excel（岗位名 + 部门 + JD 可选），系统按字段完备度自动评估 — 有 JD 走深度分析，没 JD 也能根据岗位名推断 PK 档位。一键得到全公司职级图谱。"
            cta="上传清单"
            onClick={() => onChoose('list')}
            beta
          />
          <PathCard
            label="从零建立职级体系"
            duration="30–60 分钟"
            scenes="新公司 / 转型期 / 全面重构"
            description="先访谈了解你们公司基本面（4 个问题），AI 根据组织画像生成 20–40 个推荐岗位库，你从里面选岗 + 校准。Sparky 全程在旁边给建议、做一致性检查。"
            cta="开始访谈"
            onClick={() => onChoose('system')}
          />
        </div>

        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          fontSize: 11, color: '#64748B', lineHeight: 1.7,
        }}>
          三条路径不是孤立的。比如先单评几个岗位后，我会主动建议把它们放到职级图谱里看全局；
          或者批量评估后发现某几个岗位需要精细评，可以单独点进去上传 JD。
        </div>
      </Workspace>
    </div>
  );
}

// ============================================================================
// 路径卡片
// ============================================================================
function PathCard({ label, duration, scenes, description, cta, onClick, beta }: {
  label: string;
  duration: string;
  scenes: string;
  description: string;
  cta: string;
  onClick: () => void;
  beta?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hover ? BRAND : '#E2E8F0'}`,
        borderRadius: 12, padding: 18,
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: hover ? `0 4px 12px rgba(216, 90, 48, 0.08)` : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>{label}</span>
            {beta && (
              <span style={{
                padding: '1px 6px', fontSize: 10, fontWeight: 600,
                background: '#FEF3C7', color: '#92400E', borderRadius: 3,
              }}>
                即将完整支持
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
            {scenes} · {duration}
          </div>
        </div>
        <span style={{
          padding: '6px 14px', fontSize: 12, borderRadius: 6,
          background: hover ? BRAND : BRAND_TINT,
          color: hover ? '#fff' : BRAND,
          fontWeight: 500,
          transition: 'all 0.15s',
          flexShrink: 0,
        }}>
          {cta} →
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.7, marginTop: 8 }}>
        {description}
      </div>
    </div>
  );
}

// ---------- 关键词分发 ----------
function inferPath(text: string): EntryPath | null {
  const t = text.toLowerCase();
  // 优先级：体系 > 清单 > 单评（"建立全公司体系"也包含"评"字，要先排除）
  if (/(建立|从零|体系|全公司|访谈|组织画像)/i.test(t)) return 'system';
  if (/(清单|批量|excel|表格|上传.*岗位|一批|很多.*岗位)/i.test(t)) return 'list';
  if (/(评|看一下|定级|这个岗位)/i.test(t)) return 'single';
  return null;
}

// ---------- 流式打字 ----------
function streamText(text: string, onUpdate: (t: string) => void, onDone?: () => void) {
  let displayed = 0;
  const timer = setInterval(() => {
    displayed = Math.min(displayed + 1, text.length);
    onUpdate(text.slice(0, displayed));
    if (displayed >= text.length) {
      clearInterval(timer);
      onDone?.();
    }
  }, 25);
}
