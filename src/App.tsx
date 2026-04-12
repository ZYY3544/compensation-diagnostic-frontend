import { useState, useCallback, useRef, useEffect } from 'react';
import TopNav from './components/layout/TopNav';
import SparkyPanel from './components/layout/SparkyPanel';
import InterviewView from './components/stage3/InterviewView';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import ReportView from './components/stage4/ReportView';
import PixelCat from './components/shared/PixelCat';
import { createSession, uploadFile, runAnalysis, getReport } from './api/client';
import type { Stage, Message, ParseResult, ReportData } from './types';
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

// Dev 模式：?dev=1 跳过访谈，直接进入上传阶段
const DEV_MODE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1';

const MOCK_INTERVIEW_NOTES = {
  answers: {},
  blockContents: {
    block1: ['**行业**：跨境电商，主营消费电子出海\n**规模**：正式员工约 6000 人，2025 年营收约 280 亿\n**阶段**：规模化增长，同时拓展新业务线\n**组织**：按 BU 划分（charging / 影音 / 智新 / 机器人），设有中枢职能和中台部门\n**布局**：总部深圳，国内多城市 + 海外主要国家设有 office'],
    block2: ['**战略重点**：AI 转型、业务扩张并行\n**AI 转型路径**：内部提效先行，先用在流程和协同环节，不是一上来就押注产品化\n**扩张方向**：海外新市场 + 新业务线（机器人）持续投入'],
    block3: ['**核心诉求**：控成本 + 留人\n**优先级**：控成本偏结构性（扩张和降本同时要），留人集中在研发核心岗\n**诉求来源**：业务扩张阶段，薪酬预算压力大，同时核心人才流失加剧'],
    block4: ['**流失部门**：研发（主要）、产品（次要）\n**流失层级**：P6-P7 中高级工程师，影响业务连续性\n**流失去向**：同行大厂、AI 初创公司\n**流失原因**：薪酬竞争力 + 职业发展空间'],
    block5: ['**核心职能**：研发（充电 / 影音 BU）、产品设计、跨境运营\n**关键岗位**：硬件研发、算法、海外市场运营\n**市场竞争**：研发岗位竞争激烈，主要对手是同行大厂和 AI 创业公司\n**重合信号**：流失最重的研发部门就是核心职能，风险集中'],
    block6: ['**薪酬定位**：跟随市场（没有明确的 P50/P75 定位）\n**岗位差异化**：基本一把尺子走到底，核心岗位没有特别倾斜\n**数据来源**：主要靠 HR 的同行交流，没有体系化的市场报告\n**调薪机制**：年度普调，没有明确的预算分配规则\n**固浮比**：固定为主，年终奖占比较低'],
  },
};

function App() {
  const [stage, setStage] = useState<Stage>(DEV_MODE ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [interviewNotes, setInterviewNotes] = useState<any>(DEV_MODE ? MOCK_INTERVIEW_NOTES : null);
  const [messages, setMessages] = useState<Message[]>(
    DEV_MODE ? [{ role: 'bot', text: '[ DEV ] 访谈已跳过，请直接上传薪酬数据 Excel。' }] : []
  );
  const welcomeSent = useRef(false);
  // Ref for Stage2 to register its text input handler
  const stage2InputHandlerRef = useRef<((text: string) => boolean) | null>(null);
  // Ref for Stage3 interview text handler
  const stage3TextHandlerRef = useRef<((text: string) => boolean) | null>(null);

  // Create session on app load and stream welcome message
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;

    if (DEV_MODE) {
      // Dev 模式：静默创建 session，不播欢迎语
      createSession().then(res => setSessionId(res.data.id)).catch(() => {});
      return;
    }

    // Show typing indicator
    setMessages([{ role: 'bot', text: '' }]);

    createSession().then(res => {
      setSessionId(res.data.id);
      const fullText = res.data.welcome || '';
      if (!fullText) return;

      let displayed = 0;
      const CHARS_PER_TICK = 1;
      const INTERVAL = 30;

      setTimeout(() => {
        const timer = setInterval(() => {
          displayed = Math.min(displayed + CHARS_PER_TICK, fullText.length);
          const currentText = fullText.slice(0, displayed);
          if (displayed >= fullText.length) {
            clearInterval(timer);
          }
          setMessages([{ role: 'bot', text: currentText }]);
        }, INTERVAL);
      }, 600);
    }).catch(() => {});
  }, []);

  const addMsg = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const streamMsg = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: 'bot', text: '' }]);
    let displayed = 0;
    const timer = setInterval(() => {
      displayed = Math.min(displayed + 1, text.length);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
          updated[lastIdx] = { role: 'bot', text: text.slice(0, displayed) };
        }
        return updated;
      });
      if (displayed >= text.length) clearInterval(timer);
    }, 30);
  }, []);

  // Handle upload click — call backend
  const handleUpload = async (file: File) => {
    setLoading(true);
    try {
      // 1. Create session if not already created
      let sid = sessionId;
      if (!sid) {
        const sessionRes = await createSession();
        sid = sessionRes.data.id;
        setSessionId(sid);
      }

      // 2. Upload the real file
      const uploadRes = await uploadFile(sid!, file);
      setParseResult(uploadRes.data as ParseResult);

      streamMsg(`文件 "${file.name}" 上传成功，让我先看看数据结构...`);
      setLoading(false);
      setStage(3);
    } catch (err) {
      console.warn('Upload API failed', err);
      streamMsg('上传失败了，后端服务可能还在启动中（Render 冷启动约 30 秒）。请稍后重新上传。');
      setLoading(false);
      // 不跳转，留在上传页面让用户重试
    }
  };

  // Handle interview complete -> save notes, go to upload
  const handleInterviewComplete = (notes: any) => {
    setInterviewNotes(notes);
    streamMsg('好的，我已经了解了你们的情况。现在上传薪酬数据 Excel，我来帮你做一次全面体检。');
    setStage(2);
  };

  // Handle skip interview -> go to upload
  const handleSkipInterview = () => {
    streamMsg('没问题，我们直接开始。上传公司薪酬数据 Excel，我会帮你完成数据清洗、市场对标和五大模块诊断。');
    setStage(2);
  };

  // Handle Stage 3 (DataConfirm) complete -> trigger analysis -> report
  const handleStart = async () => {
    setLoading(true);

    if (sessionId) {
      try {
        // Trigger analysis
        await runAnalysis(sessionId);
        // Wait briefly for analysis to finish, then fetch report
        await new Promise(r => setTimeout(r, 2000));
        const reportRes = await getReport(sessionId);
        setReportData(reportRes.data as ReportData);
      } catch (err) {
        console.warn('Analysis API failed', err);
      }
    }

    setTimeout(() => {
      setLoading(false);
      setStage(4);

      const score = reportData?.health_score;
      streamMsg(score
        ? `诊断报告已生成！整体薪酬健康度 ${score} 分。点击各模块查看详情，有问题随时问我。`
        : '诊断报告已生成，点击各模块查看详情，有问题随时问我。');
    }, 1000);
  };

  // Handle Stage 1/3 non-chat text input (passed to SparkyPanel via onNonChatSend)
  // 用户消息必须在 handler 之前添加，否则 handler 内部的 loading 消息会跑到用户消息上面
  const handleNonChatSend = useCallback((text: string): boolean => {
    // Stage 1 interview text sync
    if (stage === 1 && stage3TextHandlerRef.current) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      stage3TextHandlerRef.current(text);
      return true;
    }
    // Stage 3 DataConfirm text sync
    if (stage === 3 && stage2InputHandlerRef.current) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      stage2InputHandlerRef.current(text);
      return true;
    }
    return false;
  }, [stage]);

  return (
    <div className="app-container">
      <TopNav stage={stage} />
      <div className="main-layout">
        {/* Sparky Panel - LEFT */}
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={sessionId}
          visible={panelVisible}
          onClose={() => setPanelVisible(false)}
          onNonChatSend={handleNonChatSend}
        />

        {/* Content Area - RIGHT */}
        <div className="left-panel">
          {loading && stage === 2 && (
            <div className="loading-overlay fade-enter">
              <div className="spinner" />
              <div className="loading-text">正在解析...</div>
            </div>
          )}
          {loading && (stage === 3 || stage === 4) && <LoadingView />}

          {!loading && stage === 1 && (
            <InterviewView
              onComplete={handleInterviewComplete}
              onSkip={handleSkipInterview}
              setMessages={setMessages}
              textHandlerRef={stage3TextHandlerRef}
            />
          )}
          {!loading && stage === 2 && <UploadView onUpload={handleUpload} />}
          {!loading && stage === 3 && (
            <DataConfirm
              onComplete={handleStart}
              addMsg={addMsg}
              setMessages={setMessages}
              textInputRef={stage2InputHandlerRef}
              parseResult={parseResult}
              interviewNotes={interviewNotes}
            />
          )}
          {!loading && stage === 4 && <ReportView reportData={reportData} />}
        </div>

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
