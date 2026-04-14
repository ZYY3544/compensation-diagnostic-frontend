import { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Workspace, { type WorkspaceMode } from './components/layout/Workspace';
import WelcomeView from './components/layout/WelcomeView';
import SparkyPanel from './components/layout/SparkyPanel';
import InterviewView from './components/stage3/InterviewView';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import ReportView from './components/stage4/ReportView';
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
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 14, marginBottom: 8 }}>Sparky 正在分析中...</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{text}</div>
    </div>
  );
}

function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('hidden');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [interviewNotes, setInterviewNotes] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const welcomeSent = useRef(false);
  const stage2InputHandlerRef = useRef<((text: string) => boolean) | null>(null);
  const stage3TextHandlerRef = useRef<((text: string) => boolean) | null>(null);

  // 工作台显示状态：stage 控制（后续 Phase 3 会由意图识别控制）
  useEffect(() => {
    if (stage === 1 && messages.length === 0) {
      setWorkspaceMode('hidden'); // 欢迎态
    } else if (stage === 4) {
      setWorkspaceMode('wide'); // 报告阶段 60%
    } else {
      setWorkspaceMode('narrow'); // 访谈/上传/数据确认 窄
    }
  }, [stage, messages.length]);

  // Create session on app load
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;
    createSession().then(res => {
      setSessionId(res.data.id);
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

  const handleUpload = async (file: File) => {
    setLoading(true);
    addMsg({ role: 'bot', text: '收到文件，正在解析...' });
    try {
      let sid = sessionId;
      if (!sid) {
        const sessionRes = await createSession();
        sid = sessionRes.data.id;
        setSessionId(sid);
      }
      const uploadRes = await uploadFile(sid!, file);
      const result = uploadRes.data as ParseResult;
      setParseResult(result);
      const emp = result.employee_count || 0;
      const grade = result.grade_count || 0;
      const dept = result.department_count || 0;
      streamMsg(`解析完成！识别到 ${emp} 条员工记录、${grade} 个职级、${dept} 个部门。`);
      setLoading(false);
      setStage(3);
    } catch (err) {
      console.warn('Upload API failed', err);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0 && updated[lastIdx].role === 'bot') {
          updated[lastIdx] = { role: 'bot', text: '上传失败了，后端服务可能还在启动中。请稍后重新上传。' };
        }
        return updated;
      });
      setLoading(false);
    }
  };

  const handleInterviewComplete = (notes: any) => {
    setInterviewNotes(notes);
    streamMsg('好的，我已经了解了你们的情况。现在上传薪酬数据 Excel，我来帮你做一次全面体检。');
    setStage(2);
  };

  const handleSkipInterview = () => {
    streamMsg('没问题，我们直接开始。上传公司薪酬数据 Excel，我会帮你完成数据清洗、市场对标和五大模块诊断。');
    setStage(2);
  };

  const handleStart = async () => {
    setLoading(true);
    if (sessionId) {
      try {
        await runAnalysis(sessionId);
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

  const handleNonChatSend = useCallback((text: string): boolean => {
    if (stage === 1 && stage3TextHandlerRef.current) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      stage3TextHandlerRef.current(text);
      return true;
    }
    if (stage === 3 && stage2InputHandlerRef.current) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      stage2InputHandlerRef.current(text);
      return true;
    }
    return false;
  }, [stage]);

  // 首屏 chip 触发能力
  const handleChipClick = (capability: string) => {
    if (capability === 'full_diagnosis') {
      streamMsg('好的，我们做一次完整的薪酬诊断。先通过几个问题了解一下你们的业务背景，然后上传薪酬数据。');
      setStage(1);
      setWorkspaceMode('narrow');
    } else {
      streamMsg('这个能力正在开发中，敬请期待。');
    }
  };

  // 欢迎态：无消息、stage=1、工作台 hidden
  const isWelcome = workspaceMode === 'hidden' && messages.length === 0;

  const renderWorkspaceContent = () => {
    if (loading && stage === 2) {
      return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>正在解析...</div>;
    }
    if (loading && (stage === 3 || stage === 4)) return <LoadingView />;
    if (stage === 1) {
      return (
        <InterviewView
          onComplete={handleInterviewComplete}
          onSkip={handleSkipInterview}
          setMessages={setMessages}
          textHandlerRef={stage3TextHandlerRef}
        />
      );
    }
    if (stage === 2) return <UploadView onUpload={handleUpload} />;
    if (stage === 3) {
      return (
        <DataConfirm
          onComplete={handleStart}
          addMsg={addMsg}
          setMessages={setMessages}
          textInputRef={stage2InputHandlerRef}
          parseResult={parseResult}
          setParseResult={setParseResult}
          sessionId={sessionId}
          interviewNotes={interviewNotes}
        />
      );
    }
    if (stage === 4) return <ReportView reportData={reportData} sessionId={sessionId} />;
    return null;
  };

  const wsTitle = stage === 4 ? '薪酬诊断报告'
    : stage === 3 ? '数据确认'
    : stage === 2 ? '数据上传'
    : '业务访谈';

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f6f8' }}>
      {/* 左侧边栏 */}
      <Sidebar
        conversations={[
          { id: '1', title: '新对话', type: 'follow_up', updated_at: '', active: true },
        ]}
        userName="用户"
        userRole="HR"
      />

      {/* 中间对话区 */}
      <div style={{ flex: 1, minWidth: 420, display: 'flex', flexDirection: 'column', background: '#fff', borderRight: '1px solid #e8e8ec' }}>
        {/* Header */}
        <div style={{ height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #f0f0f4' }}>
          <div style={{ width: 40, height: 40, background: '#fff3e6', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐻</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Sparky</div>
            <div style={{ fontSize: 11, color: '#22c55e' }}>● 在线</div>
          </div>
        </div>

        {/* 对话内容 */}
        {isWelcome ? (
          <WelcomeView
            chips={[
              { icon: '📊', label: '做一次完整的薪酬诊断', onClick: () => handleChipClick('full_diagnosis') },
              { icon: '🔍', label: '查一下市场薪酬水平', onClick: () => handleChipClick('external_benchmark') },
              { icon: '💰', label: '候选人定薪建议', onClick: () => handleChipClick('offer_check') },
              { icon: '📈', label: '调薪预算怎么分配', onClick: () => handleChipClick('salary_simulation') },
            ]}
          />
        ) : (
          <SparkyPanel
            messages={messages}
            setMessages={setMessages}
            sessionId={sessionId}
            visible={true}
            onClose={() => {}}
            onNonChatSend={handleNonChatSend}
            embedded={true}
          />
        )}
      </div>

      {/* 右侧工作台 */}
      <Workspace
        mode={workspaceMode}
        title={stage !== 1 || messages.length > 0 ? wsTitle : undefined}
        onModeChange={workspaceMode !== 'hidden' ? setWorkspaceMode : undefined}
      >
        {renderWorkspaceContent()}
      </Workspace>
    </div>
  );
}

export default App;
