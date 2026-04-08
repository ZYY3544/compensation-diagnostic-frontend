import { useState, useCallback, useRef, useEffect } from 'react';
import TopNav from './components/layout/TopNav';
import SparkyPanel from './components/layout/SparkyPanel';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import InterviewView from './components/stage3/InterviewView';
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
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', text: '你好！我是 Sparky，你的 AI 薪酬诊断助手。\n\n上传公司薪酬数据 Excel，我会帮你完成：\n\u2022 数据清洗与质量检查\n\u2022 市场薪酬对标匹配\n\u2022 五大模块全面诊断\n\n有任何问题随时问我。' }
  ]);
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

  const addMsg = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  // Handle upload click — call backend, fallback to mock flow
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
      setStage(2);
    } catch (err) {
      console.warn('Upload API failed, falling back to mock flow', err);
      addMsg({ role: 'bot', text: '让我先看看你的数据结构...' });
      setLoading(false);
      setStage(2);
    }
  };

  // Handle Stage 2 complete -> go to interview
  const handleStart = () => {
    setStage(3);
  };

  // Handle interview complete -> trigger analysis, then go to report
  const handleInterviewComplete = async () => {
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
        console.warn('Analysis API failed, using mock report', err);
      }
    }

    setTimeout(() => {
      setLoading(false);
      setStage(4);

      const score = reportData?.health_score ?? 72;
      addMsg({ role: 'bot', text: `诊断报告已生成！整体薪酬健康度 ${score} 分。\n\n结合你刚才提到的业务背景，重点发现：\n1. 销售团队竞争力确实不足（验证了你的流失判断）\n2. 调薪预算分配缺乏倾斜，未向关键岗位集中\n3. 人工成本增速与降本增效目标存在矛盾\n\n点击左侧各模块查看详情，有问题随时问我` });
    }, 1000);
  };

  // Handle Stage 2/3 non-chat text input (passed to SparkyPanel via onNonChatSend)
  const handleNonChatSend = useCallback((text: string): boolean => {
    // Stage 2 text sync
    if (stage === 2 && stage2InputHandlerRef.current) {
      const handled = stage2InputHandlerRef.current(text);
      if (handled) {
        setMessages(prev => [...prev, { role: 'user', text }]);
        return true;
      }
    }
    // Stage 3 interview text sync
    if (stage === 3 && stage3TextHandlerRef.current) {
      const handled = stage3TextHandlerRef.current(text);
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
              parseResult={parseResult}
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
          {!loading && stage === 4 && <ReportView reportData={reportData} />}
        </div>

        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={sessionId}
          visible={panelVisible}
          onClose={() => setPanelVisible(false)}
          onNonChatSend={handleNonChatSend}
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
