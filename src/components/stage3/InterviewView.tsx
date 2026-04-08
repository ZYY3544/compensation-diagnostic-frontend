import { useState, useEffect, useRef, useCallback, type MutableRefObject } from 'react';
import type { Message } from '../../types';

interface InterviewViewProps {
  onComplete: () => void;
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
  '好，数据准备好了！在跑分析之前，我想先了解一下你们的业务背景，大概 2-3 分钟就好。\n\n先问第一个——这次做薪酬诊断，最想解决什么问题？是留人、招人、控成本、还是内部公平性？',
  '你们有没有明确的薪酬策略？比如对标市场什么水位——是想领先、跟随、还是从来没明确定过？',
  '调薪是怎么做的？每年固定调一次还是不定期？调薪预算大概多少？',
  '你们的核心职能是哪些？就是对业务增长最关键的部门或岗位。',
  '过去一年哪个部门人才流失最严重？',
  '最后一个——明年的业务战略重点是什么方向？',
];

const mockBlock2 = ['薪酬定位：对标市场 P50（非明确策略，凭感觉）', '调薪机制：每年一次，预算约 8%', '奖金机制：年终奖，无明确绩效分化'];

export default function InterviewView({ onComplete, addMsg, setShowTyping, textHandlerRef }: InterviewViewProps) {
  const [interviewStep, setInterviewStep] = useState(0);
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
  const initRef = useRef(false);

  const sendBotMsg = useCallback((text: string, delay: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setShowTyping(true);
        setTimeout(() => {
          setShowTyping(false);
          addMsg({ role: 'bot', text });
          resolve();
        }, 800);
      }, delay);
    });
  }, [addMsg, setShowTyping]);

  // Send Q1 on mount
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      sendBotMsg(questions[0], 500).then(() => {
        setInterviewStep(1);
      });
    }
  }, [sendBotMsg]);

  // Process answer for a given question step
  const processAnswer = useCallback((step: number, answerText: string) => {
    const response = sparkyResponses[answerText] || defaultResponses[step - 1] || '好的，了解了。';

    if (step === 1) {
      const content = goalMap[answerText] ? [goalMap[answerText]] : ['核心诉求：销售团队人才流失'];
      setBlockContents(prev => ({ ...prev, block1: content }));
      setAnswers(prev => ({ ...prev, goal: answerText }));
    } else if (step === 2) {
      const content = strategyMap[answerText]
        ? [strategyMap[answerText]]
        : [mockBlock2[0]];
      setBlockContents(prev => ({
        ...prev,
        block2: [...(prev.block2 || []), ...content],
      }));
      setAnswers(prev => ({ ...prev, strategy: answerText }));
    } else if (step === 3) {
      const content = raiseMap[answerText]
        ? [raiseMap[answerText]]
        : [mockBlock2[1], mockBlock2[2]];
      setBlockContents(prev => ({
        ...prev,
        block2: [...(prev.block2 || []), ...content],
      }));
      setAnswers(prev => ({ ...prev, raise: answerText }));
    } else if (step === 4) {
      const content = ['核心职能：' + answerText];
      setBlockContents(prev => ({
        ...prev,
        block3: [...(prev.block3 || []), ...content],
      }));
      setAnswers(prev => ({ ...prev, coreFunc: [answerText] }));
    } else if (step === 5) {
      const content = ['流失重灾区：' + answerText];
      setBlockContents(prev => ({
        ...prev,
        block3: [...(prev.block3 || []), ...content],
      }));
      setAnswers(prev => ({ ...prev, attrition: answerText }));
    } else if (step === 6) {
      const content = ['明年战略：' + answerText];
      setBlockContents(prev => ({
        ...prev,
        block3: [...(prev.block3 || []), ...content],
      }));
      setAnswers(prev => ({ ...prev, direction: answerText }));
    }

    if (step < 6) {
      sendBotMsg(response + '\n\n' + questions[step], 400).then(() => {
        setInterviewStep(step + 1);
      });
    } else {
      sendBotMsg('访谈差不多了！我已经把关键信息整理好了，左边可以看纪要。确认没问题的话，我就开始跑诊断分析了', 400).then(() => {
        setShowFindings(true);
        setInterviewStep(7);
      });
    }
  }, [sendBotMsg]);

  // Handle chip click from left panel
  const handleChipClick = (step: number, chipText: string) => {
    if (interviewStep !== step) return;
    addMsg({ role: 'user', text: chipText });
    processAnswer(step, chipText);
  };

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
    const chips = ['留人', '招人', '控成本', '公平性'];
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
        {interviewStep >= 1 && (
          <div className="interview-chip-row">
            <div className="chip-group">
              {chips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.goal === c ? 'active' : ''}`}
                  onClick={() => handleChipClick(1, c)}
                  disabled={interviewStep !== 1}
                  style={interviewStep !== 1 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBlock2 = () => {
    const strategyChips = ['领先市场', '跟随市场', '没明确定过'];
    const raiseChips = ['每年一次', '不定期', '没有固定机制'];
    return (
      <div className="interview-block">
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
        {interviewStep >= 2 && (
          <div className="interview-chip-row">
            <div className="interview-chip-label">薪酬定位</div>
            <div className="chip-group">
              {strategyChips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.strategy === c ? 'active' : ''}`}
                  onClick={() => handleChipClick(2, c)}
                  disabled={interviewStep !== 2}
                  style={interviewStep !== 2 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
        {interviewStep >= 3 && (
          <div className="interview-chip-row" style={{ marginTop: 8 }}>
            <div className="interview-chip-label">调薪频率</div>
            <div className="chip-group">
              {raiseChips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.raise === c ? 'active' : ''}`}
                  onClick={() => handleChipClick(3, c)}
                  disabled={interviewStep !== 3}
                  style={interviewStep !== 3 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderBlock3 = () => {
    const funcChips = ['研发', '销售', '产品', '运营'];
    const attrChips = ['研发', '销售', '市场', '人力资源', '无明显流失'];
    const dirChips = ['业务扩张', '降本增效', '数字化转型', '新市场开拓'];
    return (
      <div className="interview-block">
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
        {interviewStep >= 4 && (
          <div className="interview-chip-row">
            <div className="interview-chip-label">核心职能</div>
            <div className="chip-group">
              {funcChips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.coreFunc.includes(c) ? 'active' : ''}`}
                  onClick={() => handleChipClick(4, c)}
                  disabled={interviewStep !== 4}
                  style={interviewStep !== 4 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
        {interviewStep >= 5 && (
          <div className="interview-chip-row" style={{ marginTop: 8 }}>
            <div className="interview-chip-label">流失部门</div>
            <div className="chip-group">
              {attrChips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.attrition === c ? 'active' : ''}`}
                  onClick={() => handleChipClick(5, c)}
                  disabled={interviewStep !== 5}
                  style={interviewStep !== 5 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
        {interviewStep >= 6 && (
          <div className="interview-chip-row" style={{ marginTop: 8 }}>
            <div className="interview-chip-label">战略方向</div>
            <div className="chip-group">
              {dirChips.map(c => (
                <button
                  key={c}
                  className={`chip ${answers.direction === c ? 'active' : ''}`}
                  onClick={() => handleChipClick(6, c)}
                  disabled={interviewStep !== 6}
                  style={interviewStep !== 6 ? { opacity: 0.5, cursor: 'default' } : {}}
                >{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFindings = () => {
    if (!showFindings) return null;
    return (
      <div className="interview-findings fade-enter">
        <div className="interview-findings-title">✨ 关键发现提炼</div>
        <div className="interview-findings-text">
          客户核心诉求为销售团队留人，当前薪酬策略对标 P50 但未按职能做差异化。调薪预算 8% 按统一比例分配，未向关键岗位倾斜。建议诊断重点关注：
          <br/><br/>
          1. 销售团队各层级的外部竞争力<br/>
          2. 绩效与薪酬的关联度<br/>
          3. 不同职能间的薪酬资源分配合理性
        </div>
      </div>
    );
  };

  return (
    <div className="fade-enter">
      <div className="interview-header">
        <div className="interview-title">业务访谈</div>
        <div className="interview-subtitle">Sparky 正在了解你的业务背景，访谈结果将用于提升诊断洞察的针对性</div>
      </div>

      {renderBlock1()}
      {renderBlock2()}
      {renderBlock3()}
      {renderFindings()}

      {showFindings && (
        <button className="interview-confirm-btn fade-enter" onClick={onComplete}>
          确认纪要，开始诊断 →
        </button>
      )}
    </div>
  );
}
