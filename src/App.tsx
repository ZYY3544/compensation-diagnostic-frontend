import { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import Workspace, { type WorkspaceMode } from './components/layout/Workspace';
import WelcomeView from './components/layout/WelcomeView';
import SparkyPanel from './components/layout/SparkyPanel';
import InterviewView from './components/stage3/InterviewView';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import ReportView from './components/stage4/ReportView';
import { createSession, uploadFile, runAnalysis, getReport, getSkillRegistry, invokeSkill, classifyIntent } from './api/client';
import CardRenderer from './components/cards/CardRenderer';
import { nextMsgId } from './lib/msgId';
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
  const [adviceData, setAdviceData] = useState<{ advice: any[]; closing: string } | null>(null);
  const [interviewNotes, setInterviewNotes] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [skillChips, setSkillChips] = useState<any[]>([]);
  // Skill 调用结果（供 CardRenderer 渲染）
  const [skillResult, setSkillResult] = useState<{
    components: any[];
    data: any;
    narrative?: string;
    title?: string;
    subtitle?: string;
  } | null>(null);
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

  // Create session + 拉取 skill 列表
  useEffect(() => {
    if (welcomeSent.current) return;
    welcomeSent.current = true;
    createSession().then(res => {
      setSessionId(res.data.id);
    }).catch(() => {});
    // 拉 chip
    getSkillRegistry().then(res => {
      const skills = res.data.skills || [];
      setSkillChips(skills.map((s: any) => ({
        icon: s.chip_icon || '🔹',
        label: s.chip_label || s.display_name,
        skillKey: s.key,
      })));
    }).catch(() => {});
  }, []);

  const addMsg = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const streamMsg = useCallback((text: string) => {
    const id = nextMsgId();
    setMessages(prev => [...prev, { id, role: 'bot', text: '' }]);
    let displayed = 0;
    const timer = setInterval(() => {
      displayed = Math.min(displayed + 1, text.length);
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: text.slice(0, displayed) } : m));
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
      streamMsg('上传失败了，后端服务可能还在启动中。请稍后重新上传。');
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
    // 访谈、数据确认阶段优先走原有 handler
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

    // 欢迎态 + 报告阶段：走意图识别（AI 一次调用同时分类 + 提取参数）
    setMessages(prev => [...prev, { role: 'user', text }]);
    (async () => {
      try {
        const intent = await classifyIntent(text);
        const skillKey: string = intent.data?.skill || 'unclear';
        const confidence: number = Number(intent.data?.confidence ?? 0);
        const params: Record<string, any> = intent.data?.params || {};

        // 低置信度或无法识别 → Sparky 追问
        if (skillKey === 'unclear' || confidence < 0.6) {
          streamMsg(
            '我不太确定你想做哪件事。你可以告诉我更具体一点吗？' +
            '比如：「研发部门 L5 跟市场比怎么样」「HRBP 经理候选人要价 35k 给不给」' +
            '或者直接点下面的 chip。'
          );
          return;
        }
        await dispatchSkill(skillKey, text, params);
      } catch (err) {
        console.warn('[Intent] classification failed', err);
        streamMsg('意图识别服务暂时不可用，请稍后再试。');
      }
    })();
    return true;
  }, [stage, sessionId]);

  // Skill 分发：根据 skill 类型决定走 wizard 还是直接调 invoke
  // params 来自意图识别里 AI 提取的部门/职级/城市/金额
  const dispatchSkill = async (skillKey: string, _originalMessage: string, params: Record<string, any> = {}) => {
    if (skillKey === 'full_diagnosis') {
      streamMsg('好的，我们做一次完整的薪酬诊断。先通过几个问题了解一下你们的业务背景，然后上传薪酬数据。');
      setStage(1);
      setWorkspaceMode('narrow');
      return;
    }
    if (skillKey === 'general_question') {
      // 知识问答：纯 AI 回答，不调 engine
      try {
        const res = await invokeSkill(skillKey, sessionId || '', { question: _originalMessage });
        streamMsg(res.data.narrative || '我来帮你解答...');
      } catch {
        streamMsg('让我想想...');
      }
      return;
    }
    // 其他轻模式 skill
    if (!sessionId) {
      streamMsg('会话还没就绪，请稍候再试。');
      return;
    }
    streamMsg('让我查一下...');
    try {
      const res = await invokeSkill(skillKey, sessionId, params);
      const data = res.data;
      if (data.error) {
        streamMsg(data.error);
        return;
      }
      setSkillResult({
        components: data.skill?.render_components || [],
        data: data.result,
        narrative: data.narrative,
        title: data.skill?.display_name,
        subtitle: `调用于 ${new Date().toLocaleTimeString('zh-CN')}`,
      });
      setWorkspaceMode('narrow');
      if (data.narrative) streamMsg(data.narrative);
    } catch (err) {
      console.warn('[Skill] invoke failed', err);
      streamMsg('调用这个能力时遇到了问题，请稍后再试。');
    }
  };

  // 首屏 chip 触发能力（复用 dispatchSkill）
  const handleChipClick = (capability: string) => {
    const label = skillChips.find(c => c.skillKey === capability)?.label || capability;
    addMsg({ role: 'user', text: label });
    dispatchSkill(capability, label);
  };

  // 欢迎态：无消息、stage=1、工作台 hidden
  const isWelcome = workspaceMode === 'hidden' && messages.length === 0;

  const renderWorkspaceContent = () => {
    // 轻模式 skill 结果优先展示
    if (skillResult) {
      return (
        <CardRenderer
          components={skillResult.components}
          data={skillResult.data}
          narrative={skillResult.narrative}
          title={skillResult.title}
          subtitle={skillResult.subtitle}
        />
      );
    }

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
    if (stage === 4) return (
      <ReportView
        reportData={reportData}
        adviceData={adviceData}
        setAdviceData={setAdviceData}
        sessionId={sessionId}
        streamMsg={streamMsg}
      />
    );
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
            chips={skillChips.map((c: any) => ({
              icon: c.icon,
              label: c.label,
              onClick: () => handleChipClick(c.skillKey),
            }))}
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
