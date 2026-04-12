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
  const [panelVisible, setPanelVisible] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [interviewNotes, setInterviewNotes] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const welcomeSent = useRef(false);
  // Ref for Stage2 to register its text input handler
  const stage2InputHandlerRef = useRef<((text: string) => boolean) | null>(null);
  // Ref for Stage3 interview text handler
  const stage3TextHandlerRef = useRef<((text: string) => boolean) | null>(null);

  // Create session on app load and stream welcome message
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;

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
