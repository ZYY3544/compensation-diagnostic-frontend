import { useState, useCallback, useRef, useEffect } from 'react';
import Sidebar from './components/layout/Sidebar';
import TopNav from './components/layout/TopNav';
import Workspace, { type WorkspaceMode } from './components/layout/Workspace';
import WelcomeView from './components/layout/WelcomeView';
import SparkyPanel from './components/layout/SparkyPanel';
import InterviewView from './components/stage3/InterviewView';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import ReportView from './components/stage4/ReportView';
import { createSession, uploadFile, confirmFieldMapping, runAnalysis, getReport, getSkillRegistry, invokeSkill, classifyIntent } from './api/client';
import CardRenderer from './components/cards/CardRenderer';
import PixelCat from './components/shared/PixelCat';
import FieldMappingPanel, { type MappingSuggestion, type StandardField } from './components/stage1/FieldMappingPanel';
import { nextMsgId } from './lib/msgId';
import { FlowProvider, useFlow } from './lib/flow';
import { FULL_DIAGNOSIS_FLOW } from './skills/flows';
import type { Stage, Message, ParseResult, ReportData } from './types';
import './App.css';

interface MappingState {
  columns: string[];
  sampleRows: Array<Record<string, any>>;
  suggestion: MappingSuggestion;
  standardFields: StandardField[];
}

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

function AppInner() {
  const flow = useFlow();
  // stage 原来是 App 自己管的状态机。现在改成"从 flow.currentStep 派生"，
  // 给还在引用 stage 的地方（handleNonChatSend 的输入路由、wsTitle）做兼容。
  // 没有 active flow 时 stage=1（欢迎/访谈位）。
  const stage: Stage = (() => {
    const id = flow.currentStep?.id;
    if (id === 'interview') return 1;
    if (id === 'upload') return 2;
    if (id === 'confirm') return 3;
    if (id === 'analyze' || id === 'report') return 4;
    return 1;
  })();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('hidden');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [mappingState, setMappingState] = useState<MappingState | null>(null);
  const [mappingSubmitting, setMappingSubmitting] = useState(false);
  // 每次"新对话 / 薪酬诊断"递增——作为 InterviewView 的 key 强制重挂载，
  // 避免上一次访谈的 interviewStep / answers 等本地 state 残留
  const [conversationKey, setConversationKey] = useState(0);
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
      const result = uploadRes.data as any;
      // Path B：后端说需要字段映射确认 → 进 confirm 步，用 mappingState 触发 FieldMappingPanel
      if (result.mapping_needed) {
        setMappingState({
          columns: result.columns || [],
          sampleRows: result.sample_rows || [],
          suggestion: result.suggestion || { mappings: [], unmapped: [], missing_required: [], missing_optional: [] },
          standardFields: result.standard_fields || [],
        });
        setLoading(false);
        flow.advance();   // upload → confirm（在 confirm 步里，mappingState 非空就先渲染映射面板）
        setWorkspaceMode('narrow');
        streamMsg(
          `我看了一下你的数据，识别到 ${result.suggestion?.mappings?.length || 0} 个字段，` +
          `${result.suggestion?.missing_required?.length || 0} 个必填字段还没找到。` +
          `右边是我的理解，你确认一下对不对；识别错的可以改下拉框，不用的列保留"忽略"就行。`
        );
        return;
      }
      // Path A：模板匹配，直接进数据确认
      const parseResult = result as ParseResult;
      setParseResult(parseResult);
      const emp = parseResult.employee_count || 0;
      const grade = parseResult.grade_count || 0;
      const dept = parseResult.department_count || 0;
      streamMsg(`解析完成！识别到 ${emp} 条员工记录、${grade} 个职级、${dept} 个部门。`);
      setLoading(false);
      flow.advance({ parseResult });   // upload → confirm
      setWorkspaceMode('narrow');
    } catch (err) {
      console.warn('Upload API failed', err);
      streamMsg('上传失败了，后端服务可能还在启动中。请稍后重新上传。');
      setLoading(false);
    }
  };

  // 用户在 FieldMappingPanel 确认字段映射后调这个
  const handleConfirmMapping = async (
    mappings: Array<{ user_column: string; system_field: string }>,
  ) => {
    if (!sessionId) return;
    setMappingSubmitting(true);
    try {
      const res = await confirmFieldMapping(sessionId, mappings);
      const data = res.data as ParseResult;
      setParseResult(data);
      setMappingState(null);
      const emp = data.employee_count || 0;
      const grade = data.grade_count || 0;
      const dept = data.department_count || 0;
      streamMsg(`好的，字段映射确认完毕。识别到 ${emp} 条员工记录、${grade} 个职级、${dept} 个部门，进入数据确认。`);
    } catch (err) {
      console.warn('[confirm-mapping] failed', err);
      streamMsg('映射确认后解析失败，请检查数据格式或刷新重试。');
    } finally {
      setMappingSubmitting(false);
    }
  };

  const handleInterviewComplete = (notes: any) => {
    setInterviewNotes(notes);
    streamMsg('好的，我已经了解了你们的情况。现在上传薪酬数据 Excel，我来帮你做一次全面体检。');
    flow.advance({ interviewNotes: notes });  // interview → upload
    setWorkspaceMode('narrow');
  };

  const handleSkipInterview = () => {
    streamMsg('没问题，我们直接开始。上传公司薪酬数据 Excel，我会帮你完成数据清洗、市场对标和五大模块诊断。');
    flow.advance();  // interview → upload（标 skipped 语义留给后续需要时）
    setWorkspaceMode('narrow');
  };

  // DataConfirm 的 onComplete 回调——进 analyze 步（auto-step，由下方 useEffect 触发分析）
  const handleStart = () => {
    flow.advance();  // confirm → analyze
  };

  // analyze 是 auto-step：进入即跑 runAnalysis + getReport；30s 超时 markError
  // useEffect 依赖 currentStep 的 id+status，用户点"重试"时 retry() 把 status
  // 从 error 切回 in_progress，effect 会重跑
  useEffect(() => {
    const step = flow.currentStep;
    if (!step) return;
    if (step.id !== 'analyze' || step.status !== 'in_progress') return;
    if (!sessionId) {
      flow.markError('会话丢失，无法开始分析。请重新上传数据。');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setWorkspaceMode('narrow');

    const analysisPromise = (async () => {
      await runAnalysis(sessionId);
      await new Promise(r => setTimeout(r, 500));
      const reportRes = await getReport(sessionId);
      return reportRes.data as ReportData;
    })();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 30000),
    );

    Promise.race([analysisPromise, timeoutPromise])
      .then(report => {
        if (cancelled) return;
        setReportData(report);
        setLoading(false);
        setWorkspaceMode('wide');
        const score = (report as ReportData)?.health_score;
        streamMsg(score
          ? `诊断报告已生成！整体薪酬健康度 ${score} 分。点击各模块查看详情，有问题随时问我。`
          : '诊断报告已生成，点击各模块查看详情，有问题随时问我。');
        flow.advance({ reportData: report });  // analyze → report
      })
      .catch(err => {
        if (cancelled) return;
        setLoading(false);
        const isTimeout = err instanceof Error && err.message === 'TIMEOUT';
        const msg = isTimeout
          ? '分析超过 30 秒还没返回，先停在这里。网络或后端可能忙，点"重试"可以再跑一次。'
          : '分析过程中出问题了。可以点"重试"再跑一次，或者回到数据确认检查数据。';
        console.warn('[analyze] failed', err);
        streamMsg(msg);
        flow.markError(isTimeout ? 'TIMEOUT' : 'ANALYZE_FAILED');
      });

    return () => { cancelled = true; };
  }, [flow.currentStep?.id, flow.currentStep?.status, sessionId]);

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
      // 初始化 flow；currentStep = interview，组件从 flow 读当前步
      flow.start('full_diagnosis', FULL_DIAGNOSIS_FLOW);
      setWorkspaceMode('narrow');
      setConversationKey(k => k + 1);    // 防御性 fallback 保留
      streamMsg(
        '好的，我们做一次完整的薪酬诊断。我会先通过几个问题了解你们的业务背景，' +
        '访谈完直接上传薪酬数据，然后给你做诊断。\n\n' +
        '**先从公司基本情况聊起：你们主要做什么业务？目前的规模和发展阶段大概是什么样？**'
      );
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

  // 首屏 chip 触发能力（复用 dispatchSkill）。chip_label 在后端是带 emoji 前缀的
  // （比如 "📊 做一次完整的薪酬诊断"），用作用户气泡时剥掉 emoji 保持对话区无图标
  const handleChipClick = (capability: string) => {
    const raw = skillChips.find(c => c.skillKey === capability)?.label || capability;
    const cleanLabel = raw.replace(/^[^A-Za-z0-9\u4e00-\u9fa5]+\s*/, '').trim();
    addMsg({ role: 'user', text: cleanLabel });
    dispatchSkill(capability, cleanLabel);
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

    // 无 active flow → 工作台空（欢迎态 / 普通聊天 / 轻 skill 已渲染过）
    const step = flow.currentStep;
    if (!step) return null;

    // analyze 步：error 时展示重试卡；in_progress 时展示 LoadingView
    if (step.id === 'analyze') {
      if (step.status === 'error') {
        return (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12, color: 'var(--text-primary)' }}>
              分析中断了
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.7 }}>
              {step.error === 'TIMEOUT'
                ? '等了 30 秒还没返回，后端可能在热身或网络有点卡。'
                : '分析过程中出了问题。'}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                onClick={() => flow.retry()}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: 'var(--brand)', color: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                重试分析
              </button>
              <button
                onClick={() => flow.goTo('confirm')}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)',
                  background: '#fff', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}
              >
                回到数据确认
              </button>
            </div>
          </div>
        );
      }
      return <LoadingView />;
    }

    if (step.id === 'interview') {
      return (
        <InterviewView
          key={conversationKey}
          onComplete={handleInterviewComplete}
          onSkip={handleSkipInterview}
          setMessages={setMessages}
          textHandlerRef={stage3TextHandlerRef}
        />
      );
    }
    if (step.id === 'upload') {
      if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>正在解析...</div>;
      return <UploadView onUpload={handleUpload} />;
    }
    if (step.id === 'confirm') {
      // confirm 步内部分叉：mappingState 非空 → 先展示字段映射面板；否则走 DataConfirm
      if (mappingState) {
        return (
          <FieldMappingPanel
            columns={mappingState.columns}
            sampleRows={mappingState.sampleRows}
            suggestion={mappingState.suggestion}
            standardFields={mappingState.standardFields}
            onConfirm={handleConfirmMapping}
            submitting={mappingSubmitting}
          />
        );
      }
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
    if (step.id === 'report') return (
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
    : stage === 3 ? (mappingState ? '字段映射确认' : '数据确认')
    : stage === 2 ? '数据上传'
    : '业务访谈';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* 顶部菜单栏 —— 给浏览器 chrome 让出缓冲，放品牌 + 用户菜单（预留登录入口）*/}
      <TopNav userName="用户" userRole="HR" />
      {/* 三栏主内容 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* 左侧边栏（可收起） */}
      {sidebarOpen && (
        <Sidebar
          conversations={[]}
          onNewChat={() => {
            // flow.reset() 把 flow 状态炸掉，组件按 flow.currentStep=null 自动回欢迎态
            flow.reset();
            setMessages([]);
            setWorkspaceMode('hidden');
            setSkillResult(null);
            setParseResult(null);
            setReportData(null);
            setMappingState(null);
            setConversationKey(k => k + 1);
          }}
          onStartDiagnosis={() => {
            // 重置 flow + 清数据，dispatchSkill 内部会 flow.start(FULL_DIAGNOSIS_FLOW)
            flow.reset();
            setMessages([]);
            setParseResult(null);
            setReportData(null);
            setSkillResult(null);
            setMappingState(null);
            addMsg({ role: 'user', text: '做一次完整的薪酬诊断' });
            dispatchSkill('full_diagnosis', '做一次完整的薪酬诊断');
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
      </div> {/* 三栏主内容 wrapper 关闭 */}
    </div>
  );
}

export default function App() {
  return (
    <FlowProvider>
      <AppInner />
    </FlowProvider>
  );
}
