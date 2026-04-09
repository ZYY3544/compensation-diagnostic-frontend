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
  const [findingsText, setFindingsText] = useState<string>('');
  const [findingsLoading, setFindingsLoading] = useState(false);
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

  // Process answer: always call AI (chip or free text)
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
            fillFromExtracted([extracted]);
          }
        }, 800);

        if (followUp) {
          showFollowUp(reply);
        } else {
          advanceToNext(step, reply);
        }
      } else {
        throw new Error('API failed');
      }
    } catch {
      // Fallback: fill card with raw answer, advance with generic reply
      setTimeout(() => {
        fillFromExtracted([{ field_name: getFieldForStep(step), value: answerText }]);
      }, 800);
      advanceToNext(step, '好的，了解了。');
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
          setFindingsText(data.findings || '');
          setFindingsLoading(false);
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
