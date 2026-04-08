import { useState, useCallback, useRef, useEffect } from 'react';
import TopNav from './components/layout/TopNav';
import SparkyPanel from './components/layout/SparkyPanel';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import InterviewView from './components/stage3/InterviewView';
import ReportView from './components/stage4/ReportView';
import PixelCat from './components/shared/PixelCat';
import type { Stage, Message } from './types';
import './App.css';

function LoadingView() {
  const [text, setText] = useState('正在计算外部竞争力...');
  useEffect(() => {
    const t1 = setTimeout(() => setText('正在分析绩效相关性...'), 1200);
    const t2 = setTimeout(() => setText('正在生成洞察...'), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="loading-overlay fade-enter">
      <div className="spinner" />
      <div className="loading-text">Sparky 正在分析中...</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</div>
    </div>
  );
}

function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [loading, setLoading] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: '你好！我是 Sparky，你的 AI 薪酬诊断助手。\n\n上传公司薪酬数据 Excel，我会帮你完成：\n\u2022 数据清洗与质量检查\n\u2022 市场薪酬对标匹配\n\u2022 五大模块全面诊断\n\n有任何问题随时问我。' }
  ]);

  // Ref for Stage2 to register its text input handler
  const stage2InputHandlerRef = useRef<((text: string) => boolean) | null>(null);
  // Ref for Stage3 interview text handler
  const stage3TextHandlerRef = useRef<((text: string) => boolean) | null>(null);

  const addMsg = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Handle upload click
  const handleUpload = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStage(2);
    }, 1500);
  };

  // Handle Stage 2 complete -> go to interview
  const handleStart = () => {
    setStage(3);
  };

  // Handle interview complete -> go to report
  const handleInterviewComplete = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStage(4);
      addMsg({ role: 'bot', text: '诊断报告已生成！整体薪酬健康度 72 分。\n\n结合你刚才提到的业务背景，重点发现：\n1. 销售团队竞争力确实不足（验证了你的流失判断）\n2. 调薪预算分配缺乏倾斜，未向关键岗位集中\n3. 人工成本增速与降本增效目标存在矛盾\n\n点击左侧各模块查看详情，有问题随时问我' });
    }, 3000);
  };

  // Handle user message
  const handleSend = (text: string) => {
    addMsg({ role: 'user', text });

    // If in Stage 2, try text-based confirmation sync first
    if (stage === 2 && stage2InputHandlerRef.current) {
      const handled = stage2InputHandlerRef.current(text);
      if (handled) return;
    }

    // If in Stage 3 (interview), route to interview handler
    if (stage === 3 && stage3TextHandlerRef.current) {
      const handled = stage3TextHandlerRef.current(text);
      if (handled) return;
    }

    setTimeout(() => {
      let reply: string;
      if (text.includes('销售')) {
        reply = '销售 L4-L5 的 CR 值仅 0.84-0.88，低于市场中位 12-16%。如果这是你们的核心创收团队，建议将调薪预算的 40% 优先倾斜到这个群体，预计需要整体调升 base 约 10-15%。';
      } else if (text.includes('建议') || text.includes('怎么办') || text.includes('预算')) {
        reply = '基于诊断结果，建议调薪优先级：① 销售 L4-L5（竞争力缺口最大）② HR L3-L5（流失风险最高）③ 管理岗溢价调整。如果总预算 8%，建议按 4:2.5:1.5 分配。';
      } else if (text.includes('研发')) {
        reply = '研发团队整体竞争力良好（CR 1.02-1.07），但 L5 层级有个别偏高（CR 1.07），建议关注是否有特殊原因。整体保持即可，不建议再加大投入。';
      } else if (text.includes('管理') || text.includes('经理')) {
        reply = '管理岗溢价偏低是个结构性问题。L7 管理岗仅比专业岗高 7%，优秀技术人才很难被说服转管理。建议引入管理岗专项津贴或拉大管理岗薪酬带上限。';
      } else {
        reply = '这是个好问题。基于目前的诊断数据来看，我建议你重点关注外部竞争力模块中各职能的竞争力差异，这可能是当前最需要优先解决的问题。具体想了解哪个方面？';
      }
      addMsg({ role: 'bot', text: reply });
    }, 800);
  };

  return (
    <div className="app-container">
      <TopNav stage={stage} />
      <div className="main-layout">
        <div className="left-panel">
          {loading && stage === 1 && (
            <div className="loading-overlay fade-enter">
              <div className="spinner" />
              <div className="loading-text">正在解析...</div>
            </div>
          )}
          {loading && (stage === 2 || stage === 3) && <LoadingView />}
          {!loading && stage === 1 && <UploadView onUpload={handleUpload} />}
          {!loading && stage === 2 && (
            <DataConfirm
              onComplete={handleStart}
              addMsg={addMsg}
              setShowTyping={setShowTyping}
              textInputRef={stage2InputHandlerRef}
            />
          )}
          {!loading && stage === 3 && (
            <InterviewView
              onComplete={handleInterviewComplete}
              addMsg={addMsg}
              setShowTyping={setShowTyping}
              textHandlerRef={stage3TextHandlerRef}
            />
          )}
          {!loading && stage === 4 && <ReportView />}
        </div>

        <SparkyPanel
          messages={messages}
          onSend={handleSend}
          showTyping={showTyping}
          visible={panelVisible}
          onClose={() => setPanelVisible(false)}
        />

        {!panelVisible && (
          <button className="toggle-panel-btn" onClick={() => setPanelVisible(true)} title="打开 Sparky">
            <PixelCat size={28} />
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
