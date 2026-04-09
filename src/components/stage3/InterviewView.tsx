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

const questions = [
  '先简单介绍下你们公司吧——主要做什么业务？大概多少人？发展到什么阶段了？',
  '明年公司大方向是什么？扩张、收缩、还是转型？',
  '了解了你们的业务和方向。那这次想做薪酬诊断，主要是想解决什么问题？',
  '最近有没有觉得某个部门人特别不稳定？',
  '你们公司最核心的部门是哪些？就是如果这些人走了业务就转不动的那种',
  '最后聊聊你们薪酬是怎么管的——有没有明确的薪酬定位？调薪一般怎么操作？',
];

const questionChips: Record<number, string[]> = {
  // Q1 no chips (free text only)
  2: ['业务扩张', '降本增效', '数字化转型', '新市场开拓'],
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
  const isFollowUpRef = useRef(false);
  const lastSparkyQuestionRef = useRef('');

  // Stream bot message character by character into left panel
  const streamBotMsg = useCallback((text: string, chips?: string[]): Promise<void> => {
    return new Promise<void>((resolve) => {
      // Add empty bot message
      setMessages(prev => [...prev, { role: 'bot', text: '' }]);

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

  // Build context string from current answers for AI
  const buildContext = (): string => {
    const parts: string[] = [];
    if (blockContents.block1?.length) parts.push('【公司基本情况】' + blockContents.block1.join('；'));
    if (blockContents.block2?.length) parts.push('【战略方向】' + blockContents.block2.join('；'));
    if (blockContents.block3?.length) parts.push('【诊断诉求】' + blockContents.block3.join('；'));
    if (blockContents.block4?.length) parts.push('【流失情况】' + blockContents.block4.join('；'));
    if (blockContents.block5?.length) parts.push('【核心职能】' + blockContents.block5.join('；'));
    if (blockContents.block6?.length) parts.push('【薪酬管理现状】' + blockContents.block6.join('；'));
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

  // Get current value of the field for this step (for AI to merge with)
  const getPreviousValue = (step: number): string => {
    const field = getFieldForStep(step);
    const block = fieldToBlock[field] as keyof BlockContents | undefined;
    if (!block) return '';
    const entries = blockContents[block] || [];
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
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${API_BASE}/chat/_/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: `Q${step}`,
          question_text: questions[step - 1] || '',
          answer: answerText,
          is_follow_up: isFollowUpRef.current,
          follow_up_question: isFollowUpRef.current ? lastSparkyQuestionRef.current : '',
          previous_value: getPreviousValue(step),
          context: buildContext(),
        }),
      });

      if (!res.ok) throw new Error('API failed');

      const data = await res.json();
      const extracted = data.extracted || [];
      const reply = (data.reply || '好的，了解了。').trim();
      const followUp = data.follow_up === true;
      const items: Array<{field_name: string; value: string}> = (Array.isArray(extracted)
        ? extracted
        : extracted.value ? [extracted] : []).map(e => ({ ...e, value: (e.value || '').trim() }));

      // Step 1: Stream Sparky's reply first
      if (followUp) {
        // Extract the follow-up question from reply for next call
        const boldMatch = reply.match(/\*\*([^*]+)\*\*/);
        lastSparkyQuestionRef.current = boldMatch ? boldMatch[1] : reply.slice(-60);
        isFollowUpRef.current = true;
        await streamBotMsg(reply);
      } else if (step < 6) {
        isFollowUpRef.current = false;
        lastSparkyQuestionRef.current = '';
        const nextStep = step + 1;
        const nextQ = questions[step] || '';
        const fullReply = reply + '\n\n' + nextQ;
        const chips = questionChips[nextStep];
        await streamBotMsg(fullReply, chips);
        setInterviewStep(nextStep);
      } else {
        isFollowUpRef.current = false;
        lastSparkyQuestionRef.current = '';
        await streamBotMsg('访谈差不多了！我已经把关键信息整理好了，右边可以看纪要。确认没问题的话，就进入下一步上传数据 🚀');
        setShowFindings(true);
        setInterviewStep(7);
      }

      // Step 2: Stream card content after Sparky's reply is done (only if value actually changed)
      const changedItems = items.filter(item => {
        if (!item.value) return false;
        const block = fieldToBlock[item.field_name] as keyof BlockContents | undefined;
        if (!block) return false;
        const slotMap = fieldSlotMapRef.current[block] || {};
        const slotIdx = slotMap[item.field_name];
        const entries = blockContents[block] || [];
        const currentVal = (slotIdx !== undefined && slotIdx < entries.length) ? entries[slotIdx] : '';
        return item.value !== currentVal;
      });
      if (changedItems.length > 0) {
        await streamCardContent(changedItems);
      }

    } catch {
      // Fallback: stream generic reply, then stream raw answer into card
      const field = getFieldForStep(step);
      await streamBotMsg('好的，了解了。');
      await streamCardContent([{ field_name: field, value: answerText }]);

      if (step < 6) {
        const nextStep = step + 1;
        await streamBotMsg(questions[step], questionChips[nextStep]);
        setInterviewStep(nextStep);
      } else {
        setShowFindings(true);
        setInterviewStep(7);
      }
    }
  }, [streamBotMsg, streamCardContent, blockContents]);

  // Handle text input from Sparky panel
  const handleTextAnswer = useCallback((text: string) => {
    if (interviewStep >= 1 && interviewStep <= 6) {
      processAnswer(interviewStep, text);
      return true;
    }
    return false;
  }, [interviewStep, processAnswer]);

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

  // Generate findings via dedicated AI endpoint when all 6 questions are done
  useEffect(() => {
    if (interviewStep === 7 && !findingsText && !findingsLoading) {
      setFindingsLoading(true);
      const API_BASE = import.meta.env.VITE_API_URL || '/api';
      fetch(`${API_BASE}/chat/findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_notes: buildContext(),
        }),
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
            }
          }, 30);
        })
        .catch(() => {
          setFindingsText('关键发现生成失败，请确认网络连接后刷新重试。');
          setFindingsLoading(false);
        });
    }
  }, [interviewStep, findingsText, findingsLoading, blockContents]);

  const renderFindings = () => {
    if (!showFindings) return null;
    return (
      <div className="interview-findings fade-enter">
        <div className="interview-findings-title">✨ 关键发现提炼</div>
        <div className="interview-findings-text">
          {findingsLoading ? '正在生成关键发现...' : findingsText || '暂无'}
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

      {showFindings && (
        <button className="interview-confirm-btn fade-enter" onClick={() => onComplete({ answers, blockContents })}>
          下一步：上传数据 →
        </button>
      )}
    </div>
  );
}
