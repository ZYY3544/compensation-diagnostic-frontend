import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import type { Message } from '../../types';

interface InterviewViewProps {
  onComplete: (notes: any) => void;
  onSkip: () => void;
  addMsg: (msg: Message) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setShowTyping: (v: boolean) => void;
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

export default function InterviewView({ onComplete, onSkip, addMsg: _addMsg, setMessages, setShowTyping: _setShowTyping, textHandlerRef }: InterviewViewProps) {
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

  // Stream bot message character by character into left panel
  // Replaces the last bot message (e.g. "thinking" placeholder) instead of adding new
  const streamBotMsg = useCallback((text: string, chips?: string[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      // Replace last bot message with empty text to start streaming
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
          updated[lastIdx] = { role: 'bot', text: '' };
          return updated;
        }
        return [...prev, { role: 'bot', text: '' }];
      });

      let displayed = 0;
      const CHARS_PER_TICK = 1;
      const INTERVAL = 30;

      const timer = setInterval(() => {
        displayed = Math.min(displayed + CHARS_PER_TICK, text.length);
        const currentText = text.slice(0, displayed);
        const isDone = displayed >= text.length;

        setMessages(prev => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
            updated[lastIdx] = {
              role: 'bot',
              text: currentText,
              chips: isDone ? chips : undefined,
            };
          }
          return updated;
        });

        if (isDone) {
          clearInterval(timer);
          resolve();
        }
      }, INTERVAL);
    });
  }, [setMessages]);

  // Map field_name from AI to card block
  const fieldToBlock: Record<string, string> = {
    company_profile: 'block1',
    strategy: 'block2',
    core_goal: 'block3',
    attrition: 'block4',
    core_functions: 'block5',
    pay_strategy: 'block6',
    raise_mechanism: 'block6',
  };

  const fieldToAnswer: Record<string, keyof Answers> = {
    company_profile: 'goal',  // reuse goal slot for company_profile text
    strategy: 'direction',
    core_goal: 'goal',
    attrition: 'attrition',
    core_functions: 'coreFunc',
    pay_strategy: 'strategy',
    raise_mechanism: 'raise',
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
    const bc = blockContentsRef.current;
    const parts: string[] = [];
    if (bc.block1?.length) parts.push('【公司基本情况】' + bc.block1.join('；'));
    if (bc.block2?.length) parts.push('【战略方向】' + bc.block2.join('；'));
    if (bc.block3?.length) parts.push('【诊断诉求】' + bc.block3.join('；'));
    if (bc.block4?.length) parts.push('【流失情况】' + bc.block4.join('；'));
    if (bc.block5?.length) parts.push('【核心职能】' + bc.block5.join('；'));
    if (bc.block6?.length) parts.push('【薪酬管理现状】' + bc.block6.join('；'));
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
      6: 'pay_strategy',
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

  // Process answer: call AI, then stream reply + card content in sequence
  const processAnswer = useCallback(async (step: number, answerText: string) => {
    console.log('[Interview] processAnswer START step=', step, 'round=', roundRef.current, 'isFollowUp=', isFollowUpRef.current, 'answer=', answerText);
    // Wait a tick so user message is added first by SparkyPanel, then show thinking
    await new Promise(r => setTimeout(r, 50));
    setMessages(prev => [...prev, { role: 'bot', text: 'Sparky 正在思考...' }]);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s timeout
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
      console.log('[Interview] API OK step=', step, 'followUp=', followUp, 'isFollowUp=', isFollowUpRef.current, 'extractedCount=', Array.isArray(extracted) ? extracted.length : 0, 'replyLen=', reply.length);
      const items: Array<{field_name: string; value: string}> = (Array.isArray(extracted)
        ? extracted
        : extracted.value ? [extracted] : []).map(e => ({ ...e, value: (e.value || '').trim() }));

      // Step 1: Stream Sparky's reply first
      if (followUp) {
        console.log('[Interview] BRANCH=followUp, stay at step', step, 'round', roundRef.current, '->', roundRef.current + 1);
        // Extract the follow-up question from reply for next call
        const boldMatch = reply.match(/\*\*([^*]+)\*\*/);
        lastSparkyQuestionRef.current = boldMatch ? boldMatch[1] : reply.slice(-60);
        isFollowUpRef.current = true;
        roundRef.current += 1;
        await streamBotMsg(reply);
      } else if (step < 6) {
        const nextStep = step + 1;
        console.log('[Interview] BRANCH=advance, step', step, '->', nextStep, 'round reset to 1');
        isFollowUpRef.current = false;
        roundRef.current = 1;
        lastSparkyQuestionRef.current = '';
        const chips = questionChips[nextStep];
        await streamBotMsg(reply, chips);
        setInterviewStep(nextStep);
      } else {
        console.log('[Interview] BRANCH=finish (Q6), enter review phase');
        isFollowUpRef.current = false;
        roundRef.current = 1;
        lastSparkyQuestionRef.current = '';
        // 先展示 Q6 的收束 reply，然后进入审阅阶段（不直接生成 findings）
        await streamBotMsg(reply);
        setInterviewStep(7);
      }

      // Step 2: Stream card content after Sparky's reply is done (only if value actually changed)
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
      console.error('[Interview] CATCH step=', step, 'isFollowUp=', isFollowUpRef.current, 'err=', err);
      // Fallback: 不推进 step，停在当前问题让用户重试。
      // 仅在卡片完全空白时才用原文兜底，避免覆盖之前的好内容。
      const field = getFieldForStep(step);
      const summary = answerText.length > 80 ? answerText.slice(0, 80) + '...' : answerText;
      const prevVal = getPreviousValue(step);
      if (!prevVal) {
        await streamCardContent([{ field_name: field, value: '（待 AI 整理）' + summary }]);
      }
      await streamBotMsg('网络有点问题，没收到回复。可以再说一遍吗？');
    }
  }, [streamBotMsg, streamCardContent, blockContents]);

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

  // 审阅阶段：Q6 结束后触发 Sparky 审阅访谈纪要（两个闭环）
  // 闭环 1：Sparky 自主修订卡片（格式整理/重复合并/矛盾标记）
  // 闭环 2：Sparky 告诉用户改了什么 + 问有没有补充
  useEffect(() => {
    if (interviewStep !== 7 || reviewTriggeredRef.current) return;
    reviewTriggeredRef.current = true;

    (async () => {
      setReviewState('reviewing');
      setMessages(prev => [...prev, { role: 'bot', text: 'Sparky 正在审阅访谈纪要...' }]);

      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      try {
        const res = await fetch(`${API_BASE}/chat/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interview_notes: buildContext() }),
        });
        if (!res.ok) throw new Error('review API failed');
        const data = await res.json();
        const updates = Array.isArray(data.updates) ? data.updates : [];
        const reply = (data.reply || '纪要整理下来挺完整的。你看看还有什么想补充或者想改的？').trim();

        // 闭环 1：先把 Sparky 自主修订的卡片内容流式更新到右侧
        // loading 消息暂时不动，让用户先看到卡片在被"整理"
        if (updates.length > 0) {
          const validUpdates = updates.filter((u: { field_name: string; value: string }) =>
            u.field_name && u.value && fieldToBlock[u.field_name]
          );
          if (validUpdates.length > 0) {
            await streamCardContent(validUpdates);
          }
        }

        // 闭环 2：卡片整理完了，Sparky 再说明做了什么 + 问用户
        // streamBotMsg 会把 loading 消息替换成这段 reply
        await streamBotMsg(reply);
      } catch (err) {
        console.warn('[Interview] review failed:', err);
        await streamBotMsg('纪要整理下来挺完整的。你看看右边的卡片，有没有想补充或者修改的地方？没问题的话点下方「确认纪要 →」继续。');
      }
      setReviewState('waiting_confirm');
    })();
  }, [interviewStep, streamBotMsg, streamCardContent, setMessages]);

  // 用户确认纪要 → 生成关键发现
  const handleConfirmReview = useCallback(() => {
    if (reviewState !== 'waiting_confirm') return;
    setReviewState('generating_findings');
    setShowFindings(true);
    setFindingsLoading(true);

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_BASE}/chat/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ interview_notes: buildContext() }),
    })
      .then(res => res.json())
      .then(data => {
        const fullText = data.findings || '';
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
      });
  }, [reviewState]);

  // 处理用户在审阅阶段的补充输入
  const handleSupplement = useCallback(async (text: string) => {
    setReviewState('processing_supp');
    setMessages(prev => [...prev, { role: 'bot', text: 'Sparky 正在整理补充内容...' }]);

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    try {
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
      const updates = Array.isArray(data.updates) ? data.updates : [];
      const reply = (data.reply || '好的，我记下了。还有其他想补充的吗？').trim();

      // 先展示 Sparky 的回复（会替换 loading 消息）
      await streamBotMsg(reply);

      // 然后更新对应的卡片内容
      if (updates.length > 0) {
        const validUpdates = updates.filter((u: { field_name: string; value: string }) =>
          u.field_name && u.value && fieldToBlock[u.field_name]
        );
        if (validUpdates.length > 0) {
          await streamCardContent(validUpdates);
        }
      }
    } catch (err) {
      console.warn('[Interview] supplement failed:', err);
      await streamBotMsg('好的，我记下了。还有其他想补充的吗？没问题的话，点击下方「确认纪要 →」继续。');
    }
    setReviewState('waiting_confirm');
  }, [streamBotMsg, streamCardContent]);

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
