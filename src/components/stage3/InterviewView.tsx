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
  '领先市场': '薪酬定位：领先市场（P75 以上）',
  '跟随市场': '薪酬定位：跟随市场（P50 附近）',
  '没明确定过': '薪酬定位：无明确策略，凭经验定薪',
};
const raiseMap: Record<string, string> = {
  '每年一次': '调薪机制：年度调薪',
  '不定期': '调薪机制：不定期调整',
  '没有固定机制': '调薪机制：无固定调薪机制',
};

const sparkyResponses: Record<string, string> = {
  '留人': '明白，留住关键人才确实是重中之重。',
  '招人': '了解，吸引外部人才需要有竞争力的薪酬包。',
  '控成本': '理解，人工成本控制是当前很多企业的核心议题。',
  '公平性': '收到，内部公平性问题如果不解决，容易引发连锁反应。',
  '领先市场': '不错，领先策略能有效吸引和保留人才。',
  '跟随市场': '了解，跟随市场是比较稳妥的做法。',
  '没明确定过': '这很常见，很多企业薪酬定位其实是模糊的。',
  '每年一次': '好的，年度调薪是最常见的机制。',
  '不定期': '了解，不定期调薪灵活但也容易缺乏系统性。',
  '没有固定机制': '明白了，这可能是一个需要关注的点。',
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
  '好的，我们先聊聊你们的业务背景，大概 2-3 分钟就好。\n\n先问第一个——这次做薪酬诊断，最想解决什么问题？是留人、招人、控成本、还是内部公平性？',
  '你们有没有明确的薪酬策略？比如对标市场什么水位——是想领先、跟随、还是从来没明确定过？',
  '调薪是怎么做的？每年固定调一次还是不定期？调薪预算大概多少？',
  '你们的核心职能是哪些？就是对业务增长最关键的部门或岗位。',
  '过去一年哪个部门人才流失最严重？',
  '最后一个——明年的业务战略重点是什么方向？',
];

const questionChips: Record<number, string[]> = {
  1: ['留人', '招人', '控成本', '公平性'],
  2: ['领先市场', '跟随市场', '没明确定过'],
  3: ['每年一次', '不定期', '没有固定机制'],
  4: ['研发', '销售', '产品', '运营'],
  5: ['研发', '销售', '市场', '人力资源', '无明显流失'],
  6: ['业务扩张', '降本增效', '数字化转型', '新市场开拓'],
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
    if (step === 1) return !!goalMap[text];
    if (step === 2) return !!strategyMap[text];
    if (step === 3) return !!raiseMap[text];
    // Q4-Q6 chips are direct values, check against questionChips
    const chips = questionChips[step];
    return chips ? chips.includes(text) : false;
  };

  // Fill card content from extracted value
  const fillCard = (step: number, value: string, answerText: string) => {
    if (step === 1) {
      setBlockContents(prev => ({ ...prev, block1: [value] }));
      setAnswers(prev => ({ ...prev, goal: answerText }));
    } else if (step === 2) {
      setBlockContents(prev => ({ ...prev, block2: [...(prev.block2 || []), value] }));
      setAnswers(prev => ({ ...prev, strategy: answerText }));
    } else if (step === 3) {
      setBlockContents(prev => ({ ...prev, block2: [...(prev.block2 || []), value] }));
      setAnswers(prev => ({ ...prev, raise: answerText }));
    } else if (step === 4) {
      setBlockContents(prev => ({ ...prev, block3: [...(prev.block3 || []), value] }));
      setAnswers(prev => ({ ...prev, coreFunc: [answerText] }));
    } else if (step === 5) {
      setBlockContents(prev => ({ ...prev, block3: [...(prev.block3 || []), value] }));
      setAnswers(prev => ({ ...prev, attrition: answerText }));
    } else if (step === 6) {
      setBlockContents(prev => ({ ...prev, block3: [...(prev.block3 || []), value] }));
      setAnswers(prev => ({ ...prev, direction: answerText }));
    }
  };

  // Advance to next question
  const advanceToNext = (step: number, reply: string) => {
    if (step < 6) {
      const nextStep = step + 1;
      sendBotMsg(reply + '\n\n' + questions[step], 400, questionChips[nextStep]).then(() => {
        setInterviewStep(nextStep);
      });
    } else {
      sendBotMsg('访谈差不多了！我已经把关键信息整理好了，右边可以看纪要。确认没问题的话，就进入下一步上传数据', 400).then(() => {
        setShowFindings(true);
        setInterviewStep(7);
      });
    }
  };

  // Process answer: chip click → direct mapping; free text → call AI
  const processAnswer = useCallback(async (step: number, answerText: string) => {
    if (isChipAnswer(step, answerText)) {
      // Chip click: use hardcoded mapping, zero delay
      let value = '';
      if (step === 1) value = goalMap[answerText] || answerText;
      else if (step === 2) value = strategyMap[answerText] || answerText;
      else if (step === 3) value = raiseMap[answerText] || answerText;
      else if (step === 4) value = '核心职能：' + answerText;
      else if (step === 5) value = '流失重灾区：' + answerText;
      else if (step === 6) value = '明年战略：' + answerText;

      fillCard(step, value, answerText);
      const reply = sparkyResponses[answerText] || defaultResponses[step - 1] || '好的，了解了。';
      advanceToNext(step, reply);
    } else {
      // Free text: call AI to extract structured info
      try {
        const API_BASE = import.meta.env.VITE_API_URL || '/api';
        const res = await fetch(`${API_BASE}/chat/_/extract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question_id: `Q${step}`,
            question_text: questions[step - 1] || '',
            answer: answerText,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const extracted = data.extracted || {};
          const value = extracted.value || answerText;
          const reply = data.reply || '好的，了解了。';

          fillCard(step, value, answerText);
          advanceToNext(step, reply);
        } else {
          throw new Error('API failed');
        }
      } catch {
        // Fallback: use raw answer
        let value = answerText;
        if (step === 4) value = '核心职能：' + answerText;
        else if (step === 5) value = '流失重灾区：' + answerText;
        else if (step === 6) value = '明年战略：' + answerText;

        fillCard(step, value, answerText);
        const reply = defaultResponses[step - 1] || '好的，了解了。';
        advanceToNext(step, reply);
      }
    }
  }, [sendBotMsg]);

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

  const renderBlock1 = () => {
    return (
      <div className="interview-block">
        <div className="interview-block-title">📋 诊断诉求</div>
        {!blockContents.block1 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block1.map((line, i) => (
              <div key={i} className="interview-content-line">
                <span>{line}</span>
                <button className="edit-btn">✏️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBlock2 = () => {
    if (interviewStep < 2) return null;
    return (
      <div className="interview-block fade-in-up">
        <div className="interview-block-title">💰 薪酬策略现状</div>
        {!blockContents.block2 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block2.map((line, i) => (
              <div key={i} className="interview-content-line">
                <span>{line}</span>
                <button className="edit-btn">✏️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderBlock3 = () => {
    if (interviewStep < 4) return null;
    return (
      <div className="interview-block fade-in-up">
        <div className="interview-block-title">🏢 组织与业务背景</div>
        {!blockContents.block3 ? (
          <div className="interview-placeholder">等待访谈...</div>
        ) : (
          <div>
            {blockContents.block3.map((line, i) => (
              <div key={i} className="interview-content-line">
                <span>{line}</span>
                <button className="edit-btn">✏️</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFindings = () => {
    if (!showFindings) return null;

    // Dynamically generate findings from actual interview answers
    const b1 = blockContents.block1 || [];
    const b2 = blockContents.block2 || [];
    const b3 = blockContents.block3 || [];

    const goal = b1[0] || '未明确';
    const strategy = b2[0] || '';
    const raise = b2[1] || '';
    const coreFunc = b3.find(s => s.includes('核心职能')) || '';
    const attrition = b3.find(s => s.includes('流失')) || '';
    const direction = b3.find(s => s.includes('战略')) || '';

    // Build summary paragraph
    let summary = `客户核心诉求为${goal.replace('核心诉求：', '')}。`;
    if (strategy) summary += `${strategy}。`;
    if (raise) summary += `${raise}。`;

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

      {interviewStep <= 1 && !answers.goal && (
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
