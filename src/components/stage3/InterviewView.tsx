import { useState, useEffect, useCallback, type MutableRefObject } from 'react';
import type { Message } from '../../types';

interface InterviewViewProps {
  onComplete: (notes: any) => void;
  onSkip: () => void;
  addMsg: (msg: Message) => void;
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
}

const goalMap: Record<string, string> = {
  '留人': '核心诉求：人才保留与流失防控',
  '招人': '核心诉求：提升薪酬竞争力以吸引人才',
  '控成本': '核心诉求：优化人工成本结构',
  '公平性': '核心诉求：解决内部薪酬公平性问题',
};
const strategyMap: Record<string, string> = {
  '业务扩张': '明年战略：业务扩张',
  '降本增效': '明年战略：降本增效',
  '数字化转型': '明年战略：数字化转型',
  '新市场开拓': '明年战略：新市场开拓',
};
const payStrategyMap: Record<string, string> = {
  '有明确策略': '薪酬定位：有明确的市场对标策略',
  '大概跟随市场': '薪酬定位：大致跟随市场，未精确定位',
  '没怎么定过': '薪酬定位：无明确策略，凭经验定薪',
};

const sparkyResponses: Record<string, string> = {
  '留人': '明白，留住关键人才确实是重中之重。',
  '招人': '了解，吸引外部人才需要有竞争力的薪酬包。',
  '控成本': '理解，人工成本控制是当前很多企业的核心议题。',
  '公平性': '收到，内部公平性问题如果不解决，容易引发连锁反应。',
  '业务扩张': '扩张期薪酬竞争力是关键，得确保 offer 在市场上有吸引力。',
  '降本增效': '降本增效不一定是砍人砍钱，更多是看钱有没有花在刀刃上。',
  '数字化转型': '数字化转型对人才结构影响很大，薪酬策略也要跟着调。',
  '新市场开拓': '开拓新市场意味着新的人才需求，薪酬定位要有吸引力。',
  '有明确策略': '不错，有明确策略的公司在薪酬管理上更主动。',
  '大概跟随市场': '了解，大致跟随市场是比较常见的做法。',
  '没怎么定过': '这很常见，很多快速成长的公司薪酬定位其实是模糊的。',
};

const defaultResponses = [
  '好的，了解了。',
  '收到，这个信息很有用。',
  '明白了，继续往下看。',
  '了解，这对诊断很重要。',
  '好的，记下了。',
  '收到。',
];

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

export default function InterviewView({ onComplete, onSkip, addMsg, setShowTyping, textHandlerRef }: InterviewViewProps) {
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
    block1: null,
    block2: null,
    block3: null,
  });
  const [showFindings, setShowFindings] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const sendBotMsg = useCallback((text: string, delay: number, chips?: string[]) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setShowTyping(true);
        setTimeout(() => {
          setShowTyping(false);
          addMsg({ role: 'bot', text, chips });
          resolve();
        }, 800);
      }, delay);
    });
  }, [addMsg, setShowTyping]);

  // Check if answer is a chip click (has direct mapping)
  const isChipAnswer = (step: number, text: string): boolean => {
    if (step === 1) return false; // Q1 has no chips
    if (step === 2) return !!strategyMap[text];
    if (step === 3) return !!goalMap[text];
    if (step === 6) return !!payStrategyMap[text];
    const chips = questionChips[step];
    return chips ? chips.includes(text) : false;
  };

  // Map field_name from AI to card block
  const fieldToBlock: Record<string, string> = {
    company_profile: 'block1',
    strategy: 'block1',
    core_goal: 'block2',
    attrition: 'block2',
    core_functions: 'block2',
    pay_strategy: 'block3',
    raise_mechanism: 'block3',
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

  // Fill card content from extracted array
  const fillFromExtracted = (extractedArr: Array<{field_name: string; value: string}>) => {
    for (const item of extractedArr) {
      const block = fieldToBlock[item.field_name];
      const answerKey = fieldToAnswer[item.field_name];
      if (block) {
        setBlockContents(prev => ({
          ...prev,
          [block]: [...(prev[block as keyof typeof prev] || []).filter(v => {
            // Replace existing entry for same field if updating
            const prefix = item.value.split('：')[0];
            return !v.startsWith(prefix + '：');
          }), item.value],
        }));
      }
      if (answerKey) {
        setAnswers(prev => ({
          ...prev,
          [answerKey]: answerKey === 'coreFunc' ? [item.value] : item.value,
        }));
      }
    }
  };

  // Fill card from chip mapping (simple, single field)
  const fillCardFromChip = (step: number, value: string, answerText: string) => {
    if (step === 2) {
      setBlockContents(prev => ({ ...prev, block1: [...(prev.block1 || []), value] }));
      setAnswers(prev => ({ ...prev, direction: answerText }));
    } else if (step === 3) {
      setBlockContents(prev => ({ ...prev, block2: [value, ...(prev.block2 || [])] }));
      setAnswers(prev => ({ ...prev, goal: answerText }));
    } else if (step === 4) {
      setBlockContents(prev => ({ ...prev, block2: [...(prev.block2 || []), value] }));
      setAnswers(prev => ({ ...prev, attrition: answerText }));
    } else if (step === 5) {
      setBlockContents(prev => ({ ...prev, block2: [...(prev.block2 || []), value] }));
      setAnswers(prev => ({ ...prev, coreFunc: [answerText] }));
    } else if (step === 6) {
      setBlockContents(prev => ({ ...prev, block3: [...(prev.block3 || []), value] }));
      setAnswers(prev => ({ ...prev, strategy: answerText }));
    }
  };

  // Build context string from current answers for AI
  const buildContext = (): string => {
    const parts: string[] = [];
    if (blockContents.block1?.length) parts.push('【公司概况与战略】' + blockContents.block1.join('；'));
    if (blockContents.block2?.length) parts.push('【诊断诉求与人才现状】' + blockContents.block2.join('；'));
    if (blockContents.block3?.length) parts.push('【薪酬管理现状】' + blockContents.block3.join('；'));
    return parts.join('\n');
  };

  // Advance to next question
  const advanceToNext = (step: number, reply: string) => {
    if (step < 6) {
      const nextStep = step + 1;
      sendBotMsg(reply + '\n\n' + questions[step], 400, questionChips[nextStep]).then(() => {
        setInterviewStep(nextStep);
      });
    } else {
      sendBotMsg('访谈差不多了！我已经把关键信息整理好了，右边可以看纪要。确认没问题的话，就进入下一步上传数据 🚀', 400).then(() => {
        setShowFindings(true);
        setInterviewStep(7);
      });
    }
  };

  // Show AI reply without advancing (follow_up mode)
  const showFollowUp = (reply: string) => {
    sendBotMsg(reply, 400);
  };

  // Process answer: chip click → direct mapping; free text → call AI with follow_up
  const processAnswer = useCallback(async (step: number, answerText: string) => {
    if (isChipAnswer(step, answerText)) {
      // Chip click: hardcoded mapping, skip AI, always advance
      let value = '';
      if (step === 2) value = strategyMap[answerText] || '明年战略：' + answerText;
      else if (step === 3) value = goalMap[answerText] || answerText;
      else if (step === 4) value = '流失重灾区：' + answerText;
      else if (step === 5) value = '核心职能：' + answerText;
      else if (step === 6) value = payStrategyMap[answerText] || '薪酬定位：' + answerText;

      const reply = sparkyResponses[answerText] || defaultResponses[step - 1] || '好的，了解了。';
      advanceToNext(step, reply);
      // Delay card update so Sparky's reply appears first
      setTimeout(() => {
        fillCardFromChip(step, value, answerText);
      }, 800);
    } else {
      // Free text: call AI with context
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_BASE}/chat/_/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: `Q${step}`,
            question_text: questions[step - 1] || '',
            answer: answerText,
            context: buildContext(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const extracted = data.extracted || [];
          const reply = data.reply || '好的，了解了。';
          const followUp = data.follow_up === true;

          // Delay card update so Sparky's reply appears first
          setTimeout(() => {
            if (Array.isArray(extracted)) {
              fillFromExtracted(extracted);
            } else if (extracted.value) {
              // Legacy single-object format
              fillFromExtracted([extracted]);
            }
          }, 800);

          if (followUp) {
            // AI is asking a follow-up, don't advance question
            showFollowUp(reply);
          } else {
            // AI is done with this topic, advance
            advanceToNext(step, reply);
          }
        } else {
          throw new Error('API failed');
        }
      } catch {
        // Fallback: fill card with raw answer, advance
        let value = answerText;
        if (step === 2) value = '明年战略：' + answerText;
        else if (step === 3) value = '核心诉求：' + answerText;
        else if (step === 4) value = '流失重灾区：' + answerText;
        else if (step === 5) value = '核心职能：' + answerText;
        else if (step === 6) value = '薪酬定位：' + answerText;

        const reply = defaultResponses[step - 1] || '好的，了解了。';
        advanceToNext(step, reply);
        // Delay card update so Sparky's reply appears first
        setTimeout(() => {
          fillCardFromChip(step, value, answerText);
        }, 800);
      }
    }
  }, [sendBotMsg, blockContents]);

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

  const renderContentLine = (blockKey: keyof BlockContents, line: string, idx: number) => {
    const editKey = `${blockKey}-${idx}`;
    if (editing === editKey) {
      return (
        <div key={idx} className="interview-content-line">
          <input
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
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, outline: 'none' }}
          />
        </div>
      );
    }
    return (
      <div key={idx} className="interview-content-line">
        <span>{line}</span>
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

  const renderBlock1 = () => {
    return (
      <div className="interview-block">
        <div className="interview-block-title">🏢 公司概况与战略</div>
        {!blockContents.block1 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block1.map((line, i) => renderContentLine('block1', line, i))}
          </div>
        )}
      </div>
    );
  };

  const renderBlock2 = () => {
    if (interviewStep < 3) return null;
    return (
      <div className="interview-block fade-in-up">
        <div className="interview-block-title">🎯 诊断诉求与人才现状</div>
        {!blockContents.block2 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block2.map((line, i) => renderContentLine('block2', line, i))}
          </div>
        )}
      </div>
    );
  };

  const renderBlock3 = () => {
    if (interviewStep < 6) return null;
    return (
      <div className="interview-block fade-in-up">
        <div className="interview-block-title">💰 薪酬管理现状</div>
        {!blockContents.block3 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block3.map((line, i) => renderContentLine('block3', line, i))}
          </div>
        )}
      </div>
    );
  };

  const renderFindings = () => {
    if (!showFindings) return null;

    // Dynamically generate findings from actual interview answers
    // block1 = company profile + strategy
    // block2 = core goal + attrition + core functions
    // block3 = pay strategy + raise mechanism
    const b1 = blockContents.block1 || [];
    const b2 = blockContents.block2 || [];
    const b3 = blockContents.block3 || [];

    const companyInfo = b1.find(s => !s.includes('战略')) || '';
    const direction = b1.find(s => s.includes('战略')) || '';
    const goal = b2.find(s => s.includes('核心诉求')) || '';
    const attrition = b2.find(s => s.includes('流失')) || '';
    const coreFunc = b2.find(s => s.includes('核心职能')) || '';
    const payStrategy = b3.find(s => s.includes('薪酬定位')) || '';
    const raise = b3.find(s => s.includes('调薪') || s.includes('机制')) || '';

    // Build summary paragraph
    let summary = '';
    if (companyInfo) summary += `${companyInfo}。`;
    if (goal) summary += `${goal.replace('核心诉求：', '核心诉求为')}。`;
    if (payStrategy) summary += `${payStrategy}。`;
    if (raise) summary += `${raise}。`;
    if (!summary) summary = '访谈信息收集完成。';

    // Build focus points based on actual answers
    const focusPoints: string[] = [];
    if (attrition) {
      const dept = attrition.replace('流失重灾区：', '');
      focusPoints.push(`${dept}的外部竞争力`);
    }
    if (goal.includes('公平') || goal.includes('内部')) {
      focusPoints.push('内部薪酬公平性与离散度');
    }
    if (goal.includes('成本') || (direction && direction.includes('降本'))) {
      focusPoints.push('人工成本结构与增速');
    }
    if (coreFunc) {
      const func = coreFunc.replace('核心职能：', '');
      focusPoints.push(`${func}职能的薪酬资源倾斜度`);
    }
    if (focusPoints.length === 0) {
      focusPoints.push('各职能的外部竞争力', '绩效与薪酬的关联度', '薪酬资源分配合理性');
    }

    return (
      <div className="interview-findings fade-enter">
        <div className="interview-findings-title">✨ 关键发现提炼</div>
        <div className="interview-findings-text">
          {summary}
          {focusPoints.length > 0 && (
            <>
              建议诊断重点关注：
              <br/><br/>
              {focusPoints.map((p, idx) => (
                <span key={idx}>{idx + 1}. {p}<br/></span>
              ))}
            </>
          )}
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

      {interviewStep <= 1 && (
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

      {renderBlock1()}
      {renderBlock2()}
      {renderBlock3()}
      {renderFindings()}

      {showFindings && (
        <button className="interview-confirm-btn fade-enter" onClick={() => onComplete({ answers, blockContents })}>
          下一步：上传数据 →
        </button>
      )}
    </div>
  );
}
