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
import PixelCat from './components/shared/PixelCat';
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

/**
 * Claude 风格的侧栏开关按钮。Lucide `PanelLeft` 图标 + 深色小 tooltip。
 * 鼠标悬停 300ms 显示"关闭侧栏 / 打开侧栏"。
 */
function SidebarToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  const [showTip, setShowTip] = useState(false);
  const label = open ? '关闭侧栏' : '打开侧栏';
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        aria-label={label}
        style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none', borderRadius: 8,
          color: 'var(--text-secondary)', cursor: 'pointer',
          transition: 'background 0.15s, color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.background = 'var(--hover)'; }}
        onBlur={e => { e.currentTarget.style.background = 'transparent'; }}
        onMouseOver={e => { e.currentTarget.style.background = 'var(--hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
        onMouseOut={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
      >
        {/* Lucide PanelLeft: 矩形 + 左侧竖线 */}
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
      </button>
      {showTip && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0,
          padding: '6px 10px',
          background: '#1F2937', color: '#fff',
          fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 200,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('hidden');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // 工作台只在"有实际内容要展示"时才出现，由具体的 handler 负责显式打开：
  //   - dispatchSkill('full_diagnosis')  → 'narrow'（访谈面板）
  //   - handleInterviewComplete / handleSkipInterview → 'narrow'（上传面板）
  //   - handleUpload success → 'narrow'（数据确认）
  //   - handleStart → 'wide'（报告）
  //   - 轻模式 skill 返回 render_components → 'narrow'
  //   - general_question / 无法识别的闲聊 → 保持 'hidden'
  // 不在这里根据 stage/messages 强制统一设置——否则用户发任何消息都会被当成进入了某个流程。

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
      setWorkspaceMode('narrow');
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
    setWorkspaceMode('narrow');
  };

  const handleSkipInterview = () => {
    streamMsg('没问题，我们直接开始。上传公司薪酬数据 Excel，我会帮你完成数据清洗、市场对标和五大模块诊断。');
    setStage(2);
    setWorkspaceMode('narrow');
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
      setWorkspaceMode('wide');
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
        const method: string = intent.data?.method || '';
        // 打印完整意图识别结果方便排查误分类
        console.log('[Intent]', text, '→', {
          skill: skillKey,
          confidence,
          params,
          method,
          reason: intent.data?.reason,
        });

        // Sparky 追问只发生在：
        //   (a) AI 明确返回 skill='unclear'
        //   (b) AI 成功判断但置信度 < 0.6
        // 后端 AI 调用失败时 fallback 成 general_question + confidence=0，
        // 这种情况不是"意图不清楚"而是"AI 连接挂了"，应该继续把问题交给
        // general_question engine 回答（engine 里会再做一次 AI 调用+重试）。
        const aiUncertain = (method === 'ai' && confidence < 0.6);
        if (skillKey === 'unclear' || aiUncertain) {
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
    } catch (err: any) {
      // 400 前置条件未满足 → 后端带 sparky_message，直接展示给用户
      // 绝不打开右侧面板，不调引擎，不生成分析结论
      const status = err?.response?.status;
      const body = err?.response?.data;
      if (status === 400 && body?.unmet) {
        console.warn('[Skill] preconditions unmet', body.unmet, 'for', skillKey);
        streamMsg(body.sparky_message || body.error || '前置条件未满足。');
        return;
      }
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
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      {/* 左侧边栏（可收起） */}
      {sidebarOpen && (
        <Sidebar
          conversations={[]}
          onNewChat={() => {
            setMessages([]);
            setStage(1);
            setWorkspaceMode('hidden');
            setSkillResult(null);
          }}
          onStartDiagnosis={() => {
            addMsg({ role: 'user', text: '📊 做一次完整的薪酬诊断' });
            dispatchSkill('full_diagnosis', '📊 做一次完整的薪酬诊断');
          }}
          userName="用户"
          userRole="HR"
        />
      )}

      {/* 中间对话区 */}
      <div style={{ flex: 1, minWidth: 420, display: 'flex', flexDirection: 'column', background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>
        {/* Header —— 侧栏开关 + 小版 PixelCat + 品牌名 */}
        <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', background: 'var(--panel-bg)' }}>
          <SidebarToggle open={sidebarOpen} onClick={() => setSidebarOpen(v => !v)} />
          <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <PixelCat size={24} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>Sparky</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI 薪酬顾问</div>
          </div>
        </div>

        {/* 对话内容 —— 永远渲染 SparkyPanel，输入框常驻底部；欢迎态时把 hero 放到消息区 */}
        <SparkyPanel
          messages={messages}
          setMessages={setMessages}
          sessionId={sessionId}
          visible={true}
          onClose={() => {}}
          onNonChatSend={handleNonChatSend}
          embedded={true}
          welcomeHero={isWelcome ? (
            <WelcomeView
              chips={skillChips.map((c: any) => ({
                label: c.label,
                onClick: () => handleChipClick(c.skillKey),
              }))}
            />
          ) : undefined}
        />
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
