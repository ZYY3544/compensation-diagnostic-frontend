import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import type { Message } from '../../types';

interface InterviewViewProps {
  onComplete: (notes: any) => void;
  onSkip: () => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  textHandlerRef: MutableRefObject<((text: string) => boolean) | null>;
}

interface Answers {
  goal: string | null;
  strategy: string | null;
  raise: string | null;
  coreFunc: string[];
  attrition: string | null;
  direction: string | null;
}

interface BlockContents {
  block1: string[] | null;
  block2: string[] | null;
  block3: string[] | null;
  block4: string[] | null;
  block5: string[] | null;
  block6: string[] | null;
}

// 仅传主题给 AI，具体问题由 AI 根据 prompt 自由发挥
const questionTopics = [
  '公司基本情况',
  '战略方向',
  '诊断诉求',
  '流失情况',
  '核心职能',
  '薪酬管理现状',
];

const questionChips: Record<number, string[]> = {
  // Q1 no chips (free text only)
  2: ['业务扩张', '降本增效', 'AI转型', '新市场开拓'],
  3: ['留人', '招人', '控成本', '公平性'],
  4: ['研发', '销售', '产品', '运营', '没有明显流失'],
  5: ['研发', '销售', '产品', '运营', '市场'],
  6: ['有明确策略', '大概跟随市场', '没怎么定过'],
};

export default function InterviewView({ onComplete, onSkip, setMessages, textHandlerRef }: InterviewViewProps) {
  const [interviewStep, setInterviewStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>({
    goal: null,
    strategy: null,
    raise: null,
    coreFunc: [],
    attrition: null,
    direction: null,
  });
  const [blockContents, setBlockContents] = useState<BlockContents>({
    block1: null, block2: null, block3: null,
    block4: null, block5: null, block6: null,
  });
  // 用户补充时 AI 新建的额外卡片（非原始 6 张）
  const [extraBlocks, setExtraBlocks] = useState<Array<{ key: string; title: string }>>([]);
  const [showFindings, setShowFindings] = useState(false);
  const [findingsText, setFindingsText] = useState<string>('');
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  // 审阅阶段状态机：
  // 'none'              = 尚未进入审阅（访谈进行中）
  // 'reviewing'         = Sparky 正在审阅纪要
  // 'waiting_confirm'   = 展示审阅结果，等待用户补充或点确认按钮
  // 'processing_supp'   = 正在处理用户的补充内容
  // 'generating_findings' = 用户已确认，正在生成关键发现
  // 'done'              = 关键发现已生成，显示上传按钮
  type ReviewState = 'none' | 'reviewing' | 'waiting_confirm' | 'processing_supp' | 'generating_findings' | 'done';
  const [reviewState, setReviewState] = useState<ReviewState>('none');
  const reviewTriggeredRef = useRef(false);
  const isFollowUpRef = useRef(false);
  const lastSparkyQuestionRef = useRef('');
  // 当前问题的回答轮次：1=首次回答，2=第一次追问回答，3=第二次追问回答 ...
  const roundRef = useRef(1);
  // Ref to always get latest blockContents (avoids stale closure in processAnswer)
  const blockContentsRef = useRef(blockContents);
  blockContentsRef.current = blockContents;

  // 完整的 bot 回复管道：loading 动画 → 流式展示回复
  // loading 和回复强绑定在一个流程里，不会出现顺序错乱
  // loadingText: loading 动画的文本（传 null 则不显示 loading）
  // loadingMs: loading 动画持续时间（毫秒）
  const showBotReply = useCallback(async (
    replyText: string,
    options?: {
      loadingText?: string;
      loadingMs?: number;
      chips?: string[];
    },
  ): Promise<void> => {
    const { loadingText, loadingMs = 1000 + Math.random() * 500, chips } = options || {};

    // 本次消息的唯一 id——按 id 更新避免并发流互踩
    const msgId = nextMsgId();
    if (loadingText) {
      setMessages(prev => [...prev, { id: msgId, role: 'bot', text: loadingText }]);
      await new Promise(r => setTimeout(r, loadingMs));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: '' } : m));
    } else {
      setMessages(prev => [...prev, { id: msgId, role: 'bot', text: '' }]);
    }

    // 流式展示回复文本
    await new Promise<void>((resolve) => {
      let displayed = 0;
      const timer = setInterval(() => {
        displayed = Math.min(displayed + 1, replyText.length);
        const currentText = replyText.slice(0, displayed);
        const isDone = displayed >= replyText.length;

        setMessages(prev => prev.map(m => m.id === msgId ? {
          ...m,
          text: currentText,
          chips: isDone ? chips : undefined,
        } : m));

        if (isDone) {
          clearInterval(timer);
          resolve();
        }
      }, 30);
    });
  }, [setMessages]);

  // Map field_name from AI to card block
  const fieldToBlock: Record<string, string> = {
    company_profile: 'block1',
    strategy: 'block2',
    core_goal: 'block3',
    attrition: 'block4',
    core_functions: 'block5',
    pay_management: 'block6',
  };

  const fieldToAnswer: Record<string, keyof Answers> = {
    company_profile: 'goal',  // reuse goal slot for company_profile text
    strategy: 'direction',
    core_goal: 'goal',
    attrition: 'attrition',
    core_functions: 'coreFunc',
    pay_management: 'strategy',
  };

  // Track which field_name occupies which slot index in each block
  const fieldSlotMapRef = useRef<Record<string, Record<string, number>>>({});

  // Stream card content character by character into right panel cards
  const streamCardContent = useCallback((items: Array<{field_name: string; value: string}>): Promise<void> => {
    return new Promise<void>((resolve) => {
      let itemIdx = 0;
      let charIdx = 0;

      const processNext = () => {
        if (itemIdx >= items.length) { resolve(); return; }

        const item = items[itemIdx];
        const block = fieldToBlock[item.field_name] as keyof BlockContents;
        const answerKey = fieldToAnswer[item.field_name];

        if (!block) { itemIdx++; processNext(); return; }

        // Determine slot: reuse existing slot for same field_name, or create new
        const blockSlots = fieldSlotMapRef.current[block] || {};
        let slotIdx: number;

        if (item.field_name in blockSlots) {
          // Same field_name already has a slot — overwrite it
          slotIdx = blockSlots[item.field_name];
        } else {
          // New field — assign next available slot
          slotIdx = Object.keys(blockSlots).length;
          blockSlots[item.field_name] = slotIdx;
          fieldSlotMapRef.current[block] = blockSlots;
        }

        const timer = setInterval(() => {
          charIdx = Math.min(charIdx + 1, item.value.length);
          const partial = item.value.slice(0, charIdx);
          const isDone = charIdx >= item.value.length;

          setBlockContents(prev => {
            const existing = prev[block] || [];
            const updated = [...existing];
            // Ensure array is long enough
            while (updated.length <= slotIdx) updated.push('');
            updated[slotIdx] = partial;
            return { ...prev, [block]: updated };
          });

          if (isDone) {
            clearInterval(timer);
            if (answerKey) {
              setAnswers(prev => ({
                ...prev,
                [answerKey]: answerKey === 'coreFunc' ? [item.value] : item.value,
              }));
            }
            itemIdx++;
            charIdx = 0;
            processNext();
          }
        }, 30);
      };

      processNext();
    });
  }, []);

  // Build context string from current answers for AI (uses ref for latest values)
  const buildContext = (): string => {
    const bc = blockContentsRef.current as unknown as Record<string, string[] | null>;
    const parts: string[] = [];
    if (bc.block1?.length) parts.push('【公司基本情况】' + bc.block1.join('；'));
    if (bc.block2?.length) parts.push('【战略方向】' + bc.block2.join('；'));
    if (bc.block3?.length) parts.push('【诊断诉求】' + bc.block3.join('；'));
    if (bc.block4?.length) parts.push('【流失情况】' + bc.block4.join('；'));
    if (bc.block5?.length) parts.push('【核心职能】' + bc.block5.join('；'));
    if (bc.block6?.length) parts.push('【薪酬管理现状】' + bc.block6.join('；'));
    // 包含用户补充时新建的额外卡片
    for (const eb of extraBlocks) {
      const contents = bc[eb.key];
      if (contents?.length) {
        parts.push(`【${eb.title}】` + contents.join('；'));
      }
    }
    return parts.join('\n');
  };

  // Get fallback field_name for a given step
  const getFieldForStep = (step: number): string => {
    const map: Record<number, string> = {
      1: 'company_profile',
      2: 'strategy',
      3: 'core_goal',
      4: 'attrition',
      5: 'core_functions',
      6: 'pay_management',
    };
    return map[step] || 'unknown';
  };

  // Get current value of the field for this step (for AI to merge with, uses ref for latest)
  const getPreviousValue = (step: number): string => {
    const field = getFieldForStep(step);
    const block = fieldToBlock[field] as keyof BlockContents | undefined;
    if (!block) return '';
    const entries = blockContentsRef.current[block] || [];
    // For fields that share a block (e.g. Q1+Q2 both in block1), find the right entry
    const slotMap = fieldSlotMapRef.current[block] || {};
    const slotIdx = slotMap[field];
    if (slotIdx !== undefined && slotIdx < entries.length) {
      return entries[slotIdx];
    }
    return '';
  };

  // Process answer: 先调 API 拿到结果 → 再 showBotReply（loading + 流式回复绑死）
  const processAnswer = useCallback(async (step: number, answerText: string) => {
    console.log('[Interview] processAnswer START step=', step, 'round=', roundRef.current, 'isFollowUp=', isFollowUpRef.current);

    try {
      // 1. 先调 API 拿结果（用户短暂等待，不显示任何东西）
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      const res = await fetch(`${API_BASE}/chat/_/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question_id: `Q${step}`,
          question_text: questionTopics[step - 1] || '',
          answer: answerText,
          is_follow_up: isFollowUpRef.current,
          round: roundRef.current,
          follow_up_question: isFollowUpRef.current ? lastSparkyQuestionRef.current : '',
          previous_value: getPreviousValue(step),
          context: buildContext(),
        }),
      });

      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('API failed');

      const data = await res.json();
      const extracted = data.extracted || [];
      const reply = (data.reply || '好的，了解了。').trim();
      const followUp = data.follow_up === true;
      console.log('[Interview] API OK step=', step, 'followUp=', followUp);
      const items: Array<{field_name: string; value: string}> = (Array.isArray(extracted)
        ? extracted
        : extracted.value ? [extracted] : []).map(e => ({ ...e, value: (e.value || '').trim() }));

      // 2. API 结果已在手里 → showBotReply（loading 是回复的前置装饰，绑死在一起）
      if (followUp) {
        console.log('[Interview] BRANCH=followUp, stay at step', step);
        const boldMatch = reply.match(/\*\*([^*]+)\*\*/);
        lastSparkyQuestionRef.current = boldMatch ? boldMatch[1] : reply.slice(-60);
        isFollowUpRef.current = true;
        roundRef.current += 1;
        await showBotReply(reply, { loadingText: 'Sparky 正在思考...' });
      } else {
        const nextStep = step + 1;
        console.log('[Interview] BRANCH=advance, step', step, '->', nextStep);
        isFollowUpRef.current = false;
        roundRef.current = 1;
        lastSparkyQuestionRef.current = '';
        const chips = questionChips[nextStep];
        await showBotReply(reply, { loadingText: 'Sparky 正在思考...', chips });
        setInterviewStep(nextStep);
      }

      // 3. 卡片内容更新
      const changedItems = items.filter(item => {
        if (!item.value) return false;
        const block = fieldToBlock[item.field_name] as keyof BlockContents | undefined;
        if (!block) return false;
        const slotMap = fieldSlotMapRef.current[block] || {};
        const slotIdx = slotMap[item.field_name];
        const entries = blockContentsRef.current[block] || [];
        const currentVal = (slotIdx !== undefined && slotIdx < entries.length) ? entries[slotIdx] : '';
        return item.value !== currentVal;
      });
      if (changedItems.length > 0) {
        await streamCardContent(changedItems);
      }

    } catch (err) {
      console.error('[Interview] CATCH step=', step, 'err=', err);
      await showBotReply('网络有点问题，没收到回复。可以再说一遍吗？');
      const field = getFieldForStep(step);
      const summary = answerText.length > 80 ? answerText.slice(0, 80) + '...' : answerText;
      const prevVal = getPreviousValue(step);
      if (!prevVal) {
        await streamCardContent([{ field_name: field, value: '（待 AI 整理）' + summary }]);
      }
    }
  }, [showBotReply, streamCardContent, blockContents]);

  // 用户确认纪要 → 生成关键发现
  const handleConfirmReview = useCallback(() => {
    if (reviewState !== 'waiting_confirm') return;
    setReviewState('generating_findings');
    setShowFindings(true);
    setFindingsLoading(true);

    // 左侧 Sparky 给一条反馈
    setMessages(prev => [...prev, { role: 'bot', text: 'Sparky 正在生成关键提炼发现...' }]);

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_BASE}/chat/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interview_notes: buildContext() }),
    })
      .then(res => res.json())
      .then(data => {
        const fullText = data.findings || '';
        // 把 loading 消息替换成"已生成"
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
            updated[lastIdx] = { role: 'bot', text: '关键提炼发现已生成，看看右边的结果吧。如果没问题，可以点击「下一步：上传数据 →」，我们从薪酬数据维度做更量化的分析，看看有没有潜在的结构性问题。' };
          }
          return updated;
        });
        let displayed = 0;
        const timer = setInterval(() => {
          displayed = Math.min(displayed + 1, fullText.length);
          setFindingsText(fullText.slice(0, displayed));
          if (displayed >= fullText.length) {
            clearInterval(timer);
            setFindingsLoading(false);
            setReviewState('done');
          }
        }, 30);
      })
      .catch(() => {
        setFindingsText('关键发现生成失败，请确认网络连接后刷新重试。');
        setFindingsLoading(false);
        setReviewState('done');
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
            updated[lastIdx] = { role: 'bot', text: '生成失败了，请刷新重试。' };
          }
          return updated;
        });
      });
  }, [reviewState]);

  // 处理用户在审阅阶段的补充输入
  // 先调 API 拿到结果 → 再 showBotReply（loading 是回复的前置装饰，绑死）
  const handleSupplement = useCallback(async (text: string) => {
    setReviewState('processing_supp');

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    try {
      // 1. 先调 API 拿结果（不显示任何东西）
      const res = await fetch(`${API_BASE}/chat/supplement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_notes: buildContext(),
          supplement: text,
        }),
      });
      if (!res.ok) throw new Error('supplement API failed');
      const data = await res.json();
      const updates: Array<{ field_name: string; value: string; new_card_title?: string }> = Array.isArray(data.updates) ? data.updates : [];
      const reply = (data.reply || '好的，我记下了。还有其他想补充的吗？').trim();
      const noSupplement = data.no_supplement === true;

      // 2. API 结果已在手里 → showBotReply
      if (noSupplement) {
        // 用户说没有 → 没有 loading，直接展示回复
        await showBotReply(reply);
      } else {
        // 有实际补充 → loading + 流式回复
        await showBotReply(reply, { loadingText: 'Sparky 正在思考...' });

        // 3. 更新卡片
        if (updates.length > 0) {
          for (const u of updates) {
            if (!u.field_name || !u.value) continue;
            if (u.new_card_title && !fieldToBlock[u.field_name]) {
              const newBlockKey = `extra_${u.field_name}`;
              fieldToBlock[u.field_name] = newBlockKey;
              setExtraBlocks(prev => {
                if (prev.some(b => b.key === newBlockKey)) return prev;
                return [...prev, { key: newBlockKey, title: u.new_card_title! }];
              });
            }
          }
          const validUpdates = updates.filter(u =>
            u.field_name && u.value && fieldToBlock[u.field_name]
          );
          if (validUpdates.length > 0) {
            await streamCardContent(validUpdates);
          }
        }
      }
    } catch (err) {
      console.warn('[Interview] supplement failed:', err);
      await showBotReply('好的。点击右边的「确认纪要 →」，我来生成关键提炼发现。');
    }
    setReviewState('waiting_confirm');
  }, [showBotReply, streamCardContent]);

  // Handle text input from Sparky panel
  const handleTextAnswer = useCallback((text: string) => {
    if (interviewStep >= 1 && interviewStep <= 6) {
      processAnswer(interviewStep, text);
      return true;
    }
    // step=7 时根据 reviewState 分发
    if (interviewStep >= 7) {
      if (reviewState === 'waiting_confirm') {
        // 用户在审阅阶段补充信息 → 走 /supplement 流程
        handleSupplement(text);
        return true;
      }
      if (reviewState === 'reviewing' || reviewState === 'processing_supp' || reviewState === 'generating_findings') {
        // 正在处理中，让用户等一下
        setMessages(prev => [
          ...prev,
          { role: 'bot', text: '稍等一下，我还在整理呢~' },
        ]);
        return true;
      }
      // reviewState === 'done' → findings 已生成，引导到上传
      setMessages(prev => [
        ...prev,
        { role: 'bot', text: '访谈已经结束啦~ 点击下方「下一步：上传数据 →」进入诊断环节。' },
      ]);
      return true;
    }
    return false;
  }, [interviewStep, reviewState, processAnswer, handleSupplement, setMessages]);

  // Register handler with parent
  useEffect(() => {
    textHandlerRef.current = handleTextAnswer;
  }, [handleTextAnswer, textHandlerRef]);

  const PenIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  );

  // Render text with line breaks and **bold** support for card content
  const renderCardText = (text: string) => {
    return text.split('\n').map((line, li) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={li} style={{ marginBottom: li < text.split('\n').length - 1 ? 4 : 0 }}>
          {parts.map((part, pi) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={pi} style={{ color: '#0A66C2' }}>{part.slice(2, -2)}</strong>;
            }
            return <span key={pi}>{part}</span>;
          })}
        </div>
      );
    });
  };

  const renderContentLine = (blockKey: keyof BlockContents, line: string, idx: number) => {
    const editKey = `${blockKey}-${idx}`;
    if (editing === editKey) {
      return (
        <div key={idx} className="interview-content-line">
          <textarea
            autoFocus
            defaultValue={line}
            onBlur={(e) => {
              setBlockContents(prev => ({
                ...prev,
                [blockKey]: (prev[blockKey] || []).map((v, i) => i === idx ? e.target.value : v),
              }));
              setEditing(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) (e.target as HTMLTextAreaElement).blur();
            }}
            style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, outline: 'none', minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>
      );
    }
    return (
      <div key={idx} className="interview-content-line">
        <div style={{ flex: 1 }}>{renderCardText(line)}</div>
        <span
          className="edit-btn"
          style={{ cursor: 'pointer', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center' }}
          onClick={() => setEditing(editKey)}
        >
          <PenIcon />
        </span>
      </div>
    );
  };

  const blocks = [
    { key: 'block1' as const, title: '🏢 公司基本情况', showAt: 1 },
    { key: 'block2' as const, title: '🎯 战略方向', showAt: 2 },
    { key: 'block3' as const, title: '📋 诊断诉求', showAt: 3 },
    { key: 'block4' as const, title: '👥 流失情况', showAt: 4 },
    { key: 'block5' as const, title: '⚡ 核心职能', showAt: 5 },
    { key: 'block6' as const, title: '💰 薪酬管理现状', showAt: 6 },
  ];

  // 审阅阶段：Q6 结束后按顺序执行 4 个步骤
  // Step 1: Q6 收束 reply（已经在 processAnswer 里通过 showBotReply 完成）
  // Step 2: Sparky 过渡语（调 /chat/summary）
  // Step 3: Review 动画（多阶段轮播）+ 调 /chat/review + 自主修订卡片
  // Step 4: 展示修订说明 + 问补充
  useEffect(() => {
    if (interviewStep !== 7 || reviewTriggeredRef.current) return;
    reviewTriggeredRef.current = true;

    (async () => {
      setReviewState('reviewing');
      const API_BASE = import.meta.env.VITE_API_URL || '/api';

      // ── Step 2：先调 API 拿到过渡语，再通过 showBotReply 展示 ──
      let summaryText = '接下来我先把右边的访谈纪要整体理一遍，检查有没有遗漏、矛盾，或者需要补充确认的地方。';
      try {
        const summaryRes = await fetch(`${API_BASE}/chat/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interview_notes: buildContext() }),
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          summaryText = (summaryData.summary || summaryText).trim();
        }
      } catch (err) {
        console.warn('[Interview] summary failed:', err);
      }
      // showBotReply：追加一条新消息 → 流式展示过渡语（无 loading，因为 API 已经返回了）
      await showBotReply(summaryText);

      // ── Step 3：并行执行 review 动画 + API 调用 ──
      // 动画是多阶段轮播（特殊 loading，不走 showBotReply 的单条 loading 逻辑）
      const THINKING_STAGES = [
        'Sparky 正在通读六块访谈纪要...',
        'Sparky 正在检查字段完整性...',
        'Sparky 正在梳理前后信息的一致性...',
        'Sparky 正在整理格式和关键词标记...',
        'Sparky 正在做最后的检查...',
      ];
      let stageIdx = 0;
      setMessages(prev => [...prev, { role: 'bot', text: THINKING_STAGES[0] }]);
      const stageTimer = setInterval(() => {
        stageIdx = (stageIdx + 1) % THINKING_STAGES.length;
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
            updated[lastIdx] = { role: 'bot', text: THINKING_STAGES[stageIdx] };
          }
          return updated;
        });
      }, 2000);

      const minThinkingDuration = 8000;
      const startTime = Date.now();

      // 调 review API（和动画并行，先拿结果再等动画跑完）
      let reply = '纪要整理下来挺完整的，没什么需要修正的地方。除了刚才聊的这些，你还有什么想补充的？';
      let updates: Array<{ field_name: string; value: string }> = [];
      try {
        const reviewRes = await fetch(`${API_BASE}/chat/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interview_notes: buildContext() }),
        });
        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          updates = Array.isArray(reviewData.updates) ? reviewData.updates : [];
          reply = (reviewData.reply || reply).trim();
        }
      } catch (err) {
        console.warn('[Interview] review failed:', err);
      }

      // 等动画至少跑完最小时长
      const elapsed = Date.now() - startTime;
      if (elapsed < minThinkingDuration) {
        await new Promise(r => setTimeout(r, minThinkingDuration - elapsed));
      }
      clearInterval(stageTimer);

      // API 结果和动画都已就绪，现在展示结果

      // 闭环 1：自主修订卡片（流式更新右侧）
      if (updates.length > 0) {
        // 先把动画消息替换成"正在更新纪要..."
        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
            updated[lastIdx] = { role: 'bot', text: 'Sparky 正在更新纪要...' };
          }
          return updated;
        });
        const validUpdates = updates.filter((u: { field_name: string; value: string }) =>
          u.field_name && u.value && fieldToBlock[u.field_name]
        );
        if (validUpdates.length > 0) {
          await streamCardContent(validUpdates);
        }
      }

      // ── Step 4：把动画消息替换掉，展示修订说明 + 问补充 ──
      // 删掉最后一条动画/loading 消息，然后用 showBotReply 追加新消息
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'bot' &&
            /^Sparky 正在/.test(updated[lastIdx].text)) {
          updated.splice(lastIdx, 1);
        }
        return updated;
      });
      await showBotReply(reply);

      setReviewState('waiting_confirm');
    })();
  }, [interviewStep, showBotReply, streamCardContent, setMessages]);

  const renderFindings = () => {
    if (!showFindings) return null;

    // 解析换行 + **加粗**，逐段渲染
    const renderFindingsBody = () => {
      if (findingsLoading && !findingsText) {
        return <span style={{ color: 'var(--text-muted)' }}>正在生成关键发现...</span>;
      }
      if (!findingsText) return <span>暂无</span>;

      // 按空行分段
      const paragraphs = findingsText.split(/\n\s*\n/).filter(p => p.trim());
      return paragraphs.map((para, pi) => {
        // 每段内部按单个换行再分行
        const lines = para.split('\n').filter(l => l.trim());
        // 检测是否是编号段（以"数字." 开头）
        const isNumbered = /^\d+\./.test(lines[0]?.trim() || '');
        return (
          <div
            key={pi}
            style={{
              marginBottom: pi < paragraphs.length - 1 ? 12 : 0,
              paddingLeft: isNumbered ? 4 : 0,
            }}
          >
            {lines.map((line, li) => {
              // 解析行内 **加粗**
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <div key={li} style={{ lineHeight: 1.7 }}>
                  {parts.map((part, ppi) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return (
                        <strong key={ppi} style={{ color: '#0A66C2' }}>
                          {part.slice(2, -2)}
                        </strong>
                      );
                    }
                    return <span key={ppi}>{part}</span>;
                  })}
                </div>
              );
            })}
          </div>
        );
      });
    };

    return (
      <div className="interview-findings fade-enter">
        <div className="interview-findings-title">✨ 关键发现提炼</div>
        <div className="interview-findings-text">
          {renderFindingsBody()}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-enter">
      <div className="interview-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="interview-title">业务访谈</div>
            <div className="interview-subtitle">Sparky 正在了解你的业务背景，访谈结果将用于提升诊断洞察的针对性</div>
          </div>
          <span
            style={{ fontSize: 13, color: 'var(--blue)', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16, marginTop: 4 }}
            onClick={onSkip}
          >
            已准备好数据？直接上传 →
          </span>
        </div>
      </div>

      {interviewStep <= 1 && !blockContents.block1 && (
        <div className="card fade-in-up" style={{ marginBottom: 20, background: 'linear-gradient(135deg, #f0f7ff, #f8fafc)', border: '1px solid #dbeafe' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--blue)' }}>铭曦 · AI 薪酬诊断</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>上传薪酬数据，5 分钟获取专业级诊断报告</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
            <div>✓ 外部竞争力分析</div>
            <div>✓ 内部公平性分析</div>
            <div>✓ 薪酬结构分析</div>
            <div>✓ 绩效关联分析</div>
            <div>✓ 人工成本趋势</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>🔒 数据加密传输，诊断完成后可随时删除</div>
        </div>
      )}

      {blocks.map(({ key, title, showAt }) => {
        if (interviewStep < showAt) return null;
        return (
          <div key={key} className={`interview-block ${interviewStep === showAt ? 'fade-in-up' : ''}`}>
            <div className="interview-block-title">{title}</div>
            {!blockContents[key] ? (
              <div className="interview-placeholder">等待访谈...</div>
            ) : (
              <div>
                {blockContents[key]!.map((line, i) => renderContentLine(key, line, i))}
              </div>
            )}
          </div>
        );
      })}
      {extraBlocks.map(({ key, title }) => {
        const contents = (blockContents as unknown as Record<string, string[] | null>)[key];
        return (
          <div key={key} className="interview-block fade-in-up">
            <div className="interview-block-title">{title}</div>
            {!contents ? (
              <div className="interview-placeholder">等待补充...</div>
            ) : (
              <div>
                {contents.map((line: string, i: number) => renderContentLine(key as keyof BlockContents, line, i))}
              </div>
            )}
          </div>
        );
      })}
      {renderFindings()}

      {reviewState === 'waiting_confirm' && (
        <button className="interview-confirm-btn fade-enter" onClick={handleConfirmReview}>
          确认纪要 →
        </button>
      )}

      {reviewState === 'done' && (
        <button className="interview-confirm-btn fade-enter" onClick={() => onComplete({ answers, blockContents })}>
          下一步：上传数据 →
        </button>
      )}
    </div>
  );
}
