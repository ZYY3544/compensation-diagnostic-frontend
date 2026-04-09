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

function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [loading, setLoading] = useState(false);
  const [, setShowTyping] = useState(false);
  const [panelVisible, setPanelVisible] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [interviewNotes, setInterviewNotes] = useState<any>(null);
  const [_skippedInterview, setSkippedInterview] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const welcomeSent = useRef(false);
  // Ref for Stage2 to register its text input handler
  const stage2InputHandlerRef = useRef<((text: string) => boolean) | null>(null);
  // Ref for Stage3 interview text handler
  const stage3TextHandlerRef = useRef<((text: string) => boolean) | null>(null);

  // Create session on app load so Sparky can chat from Stage 1
  useEffect(() => {
    createSession().then(res => {
      setSessionId(res.data.id);
    }).catch(() => {});
  }, []);

  // Stream welcome message on mount
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;

    const fullText = '你好！我是 Sparky，你的 AI 薪酬诊断助手。在上传数据之前，我想先花 5-10 分钟了解一下你们的业务背景，这样诊断会更有针对性。\n\n先问第一个——这次做薪酬诊断，最想解决什么问题？是留人、招人、控成本、还是内部公平性？';
    const chips = ['留人', '招人', '控成本', '公平性'];

    // Show typing indicator briefly
    setMessages([{ role: 'bot', text: '' }]);

    let displayed = 0;
    const CHARS_PER_TICK = 2;
    const INTERVAL = 30;

    const startDelay = setTimeout(() => {
      const timer = setInterval(() => {
        displayed = Math.min(displayed + CHARS_PER_TICK, fullText.length);
        const currentText = fullText.slice(0, displayed);
        const isDone = displayed >= fullText.length;

        setMessages([{
          role: 'bot',
          text: currentText,
          chips: isDone ? chips : undefined,
        }]);

        if (isDone) clearInterval(timer);
      }, INTERVAL);
    }, 600);

    return () => clearTimeout(startDelay);
  }, []);

  const addMsg = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
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

      addMsg({ role: 'bot', text: `文件 "${file.name}" 上传成功，让我先看看数据结构...` });
      setLoading(false);
      setStage(3);
    } catch (err) {
      console.warn('Upload API failed', err);
      addMsg({ role: 'bot', text: '让我先看看你的数据结构...' });
      setLoading(false);
      setStage(3);
    }
  };

  // Handle interview complete -> save notes, go to upload
  const handleInterviewComplete = (notes: any) => {
    setInterviewNotes(notes);
    addMsg({ role: 'bot', text: '好的，我已经了解了你们的情况。现在上传薪酬数据 Excel，我来帮你做一次全面体检。' });
    setStage(2);
  };

  // Handle skip interview -> go to upload
  const handleSkipInterview = () => {
    setSkippedInterview(true);
    addMsg({ role: 'bot', text: '没问题，我们直接开始。上传公司薪酬数据 Excel，我会帮你完成数据清洗、市场对标和五大模块诊断。' });
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
      addMsg({ role: 'bot', text: score
        ? `诊断报告已生成！整体薪酬健康度 ${score} 分。点击各模块查看详情，有问题随时问我。`
        : '诊断报告已生成，点击各模块查看详情，有问题随时问我。' });
    }, 1000);
  };

  // Handle Stage 1/3 non-chat text input (passed to SparkyPanel via onNonChatSend)
  const handleNonChatSend = useCallback((text: string): boolean => {
    // Stage 1 interview text sync
    if (stage === 1 && stage3TextHandlerRef.current) {
      const handled = stage3TextHandlerRef.current(text);
      if (handled) {
        setMessages(prev => [...prev, { role: 'user', text }]);
        return true;
      }
    }
    // Stage 3 DataConfirm text sync
    if (stage === 3 && stage2InputHandlerRef.current) {
      const handled = stage2InputHandlerRef.current(text);
      if (handled) {
        setMessages(prev => [...prev, { role: 'user', text }]);
        return true;
      }
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
              addMsg={addMsg}
              setShowTyping={setShowTyping}
              textHandlerRef={stage3TextHandlerRef}
            />
          )}
          {!loading && stage === 2 && <UploadView onUpload={handleUpload} />}
          {!loading && stage === 3 && (
            <DataConfirm
              onComplete={handleStart}
              addMsg={addMsg}
              setShowTyping={setShowTyping}
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
