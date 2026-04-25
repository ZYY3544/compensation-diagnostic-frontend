/**
 * JE 工具的对话区。
 *
 * 设计原则（v4 重做）：
 *  - 直接复用主诊断的 SparkyPanel —— 同一个对话框组件，确保 PixelCat 头像、
 *    气泡样式、流式输出、输入框、disclaimer 全部跟主诊断一模一样
 *  - 用户进入时模拟"用户先发一条指令"，再 Sparky 流式回复（视觉上跟主诊断
 *    点 chip 触发流程一致）
 *  - 用户后续的输入通过 onNonChatSend 拦截，走 JE 自己的关键词分发
 *    （不调主诊断的 chat 端点；后续接 JE chat agent 时改这里）
 *
 * SparkyPanel 在 onNonChatSend 返回 true 时不会自己 push 用户消息，由本组件
 * 自行处理。返回 true 也阻止 SparkyPanel 创建主诊断 session（sessionId=null
 * 时 SparkyPanel 会去拉 /api/sessions，我们不希望污染）。
 */
import { useEffect, useRef, useState } from 'react';
import SparkyPanel from '../components/layout/SparkyPanel';
import { nextMsgId } from '../lib/msgId';
import type { Message } from '../types';
import type { JeJob, JeAnomaly } from '../api/client';

interface Props {
  jobs: JeJob[];
  anomalies: JeAnomaly[];
  onBatchUpload: () => void;
  onSingleEval: () => void;
  onPersonJobMatch: () => void;
  onJobByTitle: (title: string) => void;
  /** detail 视图：开场 Sparky 解释这个岗位的评估 */
  currentJob?: JeJob | null;
  /**
   * 外部触发的告警消息（如保存岗位后检测到新异常）。每次值变化（即使文本相同，
   * 用唯一 id 区分），都会让 Sparky 在 chat 里追加一条流式输出的提醒。
   */
  incomingAlert?: { id: string; text: string } | null;
}

export default function JeSparkyChat(props: Props) {
  const { jobs, anomalies, currentJob, incomingAlert } = props;
  const [messages, setMessages] = useState<Message[]>([]);
  const lastSceneRef = useRef<string>('');
  const lastAlertIdRef = useRef<string | null>(null);

  // 外部告警注入：每次 incomingAlert.id 变化追加一条 Sparky 流式消息
  useEffect(() => {
    if (!incomingAlert || incomingAlert.id === lastAlertIdRef.current) return;
    lastAlertIdRef.current = incomingAlert.id;
    const replyId = nextMsgId();
    setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
    streamText(incomingAlert.text, (t) => {
      setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
    });
  }, [incomingAlert?.id]);

  // 进入或切换"场景"时模拟用户首发 + Sparky 流式回复
  // 场景 key = currentJob.id || 'matrix'。切换场景时重置消息流（让 detail 重进
  // 显示对该岗位的解释；返回 matrix 显示通用引导）
  useEffect(() => {
    const sceneKey = currentJob?.id || 'matrix';
    if (sceneKey === lastSceneRef.current) return;
    lastSceneRef.current = sceneKey;

    const userText = currentJob
      ? `打开「${currentJob.title}」的评估详情`
      : '我要用 JE 评估岗位价值';

    const introText = currentJob
      ? buildJobIntro(currentJob)
      : buildOpeningForMatrix(jobs, anomalies);

    // 1. 立即 push 用户气泡
    const userMsg: Message = { role: 'user', text: userText };
    setMessages([userMsg]);

    // 2. 略延迟（200ms）后出现 Sparky 空气泡 + 流式打字
    const replyId = nextMsgId();
    const timer = setTimeout(() => {
      setMessages([userMsg, { id: replyId, role: 'bot', text: '' }]);
      streamText(introText, (text) => {
        setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text } : m));
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [currentJob?.id]);

  // 用户后续输入：自己 push + 关键词分发回复
  const handleNonChatSend = (text: string): boolean => {
    setMessages(prev => [...prev, { role: 'user', text }]);
    const reply = handleIntent(text, jobs, anomalies, {
      onBatchUpload: props.onBatchUpload,
      onSingleEval: props.onSingleEval,
      onPersonJobMatch: props.onPersonJobMatch,
      onJobByTitle: props.onJobByTitle,
    });
    if (reply) {
      const replyId = nextMsgId();
      setTimeout(() => {
        setMessages(prev => [...prev, { id: replyId, role: 'bot', text: '' }]);
        streamText(reply, (t) => {
          setMessages(prev => prev.map(m => m.id === replyId ? { ...m, text: t } : m));
        });
      }, 100);
    }
    return true;   // 阻止 SparkyPanel 走主诊断 chat 端点
  };

  return (
    <SparkyPanel
      messages={messages}
      setMessages={setMessages}
      sessionId={null}
      visible={true}
      onClose={() => {}}
      onNonChatSend={handleNonChatSend}
      embedded={true}
    />
  );
}

// ---------- 流式打字（前端模拟，跟 SparkyPanel 的 SSE 视觉一致） ----------

function streamText(text: string, onUpdate: (current: string) => void) {
  let displayed = 0;
  const RENDER_INTERVAL = 25;
  const timer = setInterval(() => {
    displayed = Math.min(displayed + 1, text.length);
    onUpdate(text.slice(0, displayed));
    if (displayed >= text.length) clearInterval(timer);
  }, RENDER_INTERVAL);
}

// ---------- 文案 ----------

function buildOpeningForMatrix(jobs: JeJob[], anomalies: JeAnomaly[]): string {
  const evaluated = jobs.filter(j => j.result?.job_grade != null);
  const high = anomalies.filter(a => a.severity === 'high').length;

  if (evaluated.length === 0) {
    return [
      '岗位库已经生成好了 —— 右边按部门分组的就是我推荐的标准岗位。',
      '',
      '**接下来怎么做：**',
      '• 从右边的库里勾选跟你们公司实际匹配的岗位，点"添加"建岗',
      '• 库里找不到合适的，直接告诉我（比如"我们有一个管三个产品线的产品负责人"），我推荐最接近的基准',
      '• 添加后想调因子或上传 JD 精细评估，点岗位卡进详情页',
      '',
      '建议先把主要岗位都添加上，再回头细调。',
    ].join('\n');
  }
  if (evaluated.length < 5) {
    return `已添加 ${evaluated.length} 个岗位。继续从库里勾选，主要岗位都建完后我会给整体的图谱解读 + 一致性检查。`;
  }
  const grades = evaluated.map(j => j.result!.job_grade!);
  const range = `G${Math.min(...grades)}-G${Math.max(...grades)}`;
  if (high > 0) {
    return `已添加 ${evaluated.length} 个岗位，分布在 ${range}。检测到 ${high} 个高危异常（多半是职级倒挂），需要先看一下 — 调整哪个岗位的因子或者职级？`;
  }
  return `已添加 ${evaluated.length} 个岗位，分布在 ${range}。当前没有高危异常 — 可以继续从库选岗，或点任一岗位看详情、上传 JD 精细评估。`;
}

function buildJobIntro(job: JeJob): string {
  const reasoning = (job.result?.pk_reasoning || '').trim();
  const grade = job.result?.job_grade;
  const total = job.result?.total_score;
  const head = `这是「${job.title}」的评估解释${grade != null ? `（当前 G${grade} · ${total ?? '—'} 分）` : ''}：`;
  if (reasoning) {
    return `${head}\n\n${reasoning}\n\n右边是 3 套候选方案，可以直接调档位重算，或采用其他方案。`;
  }
  return `${head}\n\n这个岗位是 HR 手改因子算出来的，没有 LLM 推理记录。要重新生成 LLM 推理可以编辑 JD。`;
}

// ---------- 关键词意图分发 ----------

function handleIntent(
  text: string,
  jobs: JeJob[],
  anomalies: JeAnomaly[],
  cb: {
    onBatchUpload: () => void;
    onSingleEval: () => void;
    onPersonJobMatch: () => void;
    onJobByTitle: (title: string) => void;
  },
): string | null {
  const t = text.toLowerCase();

  if (/(批量|excel|表格|jd 表|上传)/i.test(t)) {
    cb.onBatchUpload();
    return '好，打开批量上传面板。把 Excel 拖进去，我并行跑评估。';
  }

  if (/(单个|新增|评.*岗位|加.*岗位|添加)/i.test(t) && /(岗位|职位)/i.test(t)) {
    cb.onSingleEval();
    return '好，开评估表单。把岗位名、职能和 JD 填一下，~10 秒出结果。';
  }
  if (/^(评一个|新增|添加岗位)/i.test(t)) {
    cb.onSingleEval();
    return '好，开评估表单。';
  }

  if (/(人岗|匹配|越级|屈才)/i.test(t)) {
    cb.onPersonJobMatch();
    return '切到人岗匹配视图。员工数据要从主诊断的 session 里取，没有的话上面输入框会提示。';
  }

  if (/(异常|倒挂|膨胀|断层|高危)/i.test(t)) {
    if (anomalies.length === 0) {
      return '当前没有检测到异常 — 岗位之间的职级关系都正常。';
    }
    const high = anomalies.filter(a => a.severity === 'high');
    const list = (high.length > 0 ? high : anomalies).slice(0, 3)
      .map((a, i) => `${i + 1}. ${a.title}：${a.message}`).join('\n');
    return `当前 ${anomalies.length} 个异常${high.length > 0 ? `（其中 ${high.length} 个高危）` : ''}：\n${list}`;
  }

  const titleMatch = t.match(/(?:解释|看下|看看|查看|展开)\s*([^\s,，.。?？!！]+)/);
  if (titleMatch) {
    const target = titleMatch[1];
    const found = jobs.find(j => j.title.includes(target) || target.includes(j.title));
    if (found) {
      cb.onJobByTitle(found.title);
      return `打开「${found.title}」详情。评估解释里能看到 PK 推理 + 多解候选。`;
    }
    return `没找到包含「${target}」的岗位。可能拼写不一样，或者还没评估。`;
  }

  return '我能帮你：批量上传 / 单个评估 / 人岗匹配 / 查看异常。也可以说"解释 XXX 岗位"打开详情。';
}
