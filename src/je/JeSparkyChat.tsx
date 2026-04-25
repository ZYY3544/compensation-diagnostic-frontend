/**
 * JE 主视图左栏的 Sparky 对话区。
 *
 * 设计取舍：
 *  - 不调 LLM。关键词匹配 → 触发 props 上的操作回调。这一版的目标是"让 JE 也是
 *    对话驱动的"，不是真正的智能对话；后续接 intent_router 升级。
 *  - 占满父容器高度，输入框 + chip 沉底，消息流向上滚。
 *  - 主动消息根据 jobs / anomalies 状态变化（详见 buildOpening）。
 */
import { useEffect, useRef, useState } from 'react';
import type { JeJob, JeAnomaly } from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

type ChatMsg = { role: 'sparky' | 'user'; text: string };

interface Props {
  jobs: JeJob[];
  anomalies: JeAnomaly[];
  onBatchUpload: () => void;
  onSingleEval: () => void;
  onPersonJobMatch: () => void;
  onJobByTitle: (title: string) => void;
}

export default function JeSparkyChat({ jobs, anomalies, onBatchUpload, onSingleEval, onPersonJobMatch, onJobByTitle }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'sparky', text: buildOpening(jobs, anomalies) },
  ]);
  const [input, setInput] = useState('');
  const evaluated = jobs.filter(j => j.result?.job_grade != null);
  const initRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // jobs/anomalies 变化时重写开场白（只覆盖第一条）
  useEffect(() => {
    if (!initRef.current) { initRef.current = true; return; }
    setMessages(prev => [{ role: 'sparky', text: buildOpening(jobs, anomalies) }, ...prev.slice(1)]);
  }, [jobs.length, anomalies.length]);

  // 新消息进来自动滚到底
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    const reply = handleIntent(text, jobs, anomalies, {
      onBatchUpload, onSingleEval, onPersonJobMatch, onJobByTitle,
    });
    if (reply) {
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'sparky', text: reply }]);
      }, 200);
    }
  };

  const highCount = anomalies.filter(a => a.severity === 'high').length;

  return (
    <div style={containerStyle}>
      {/* 标题栏 */}
      <div style={headerStyle}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: BRAND_TINT, color: BRAND,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700,
        }}>S</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Sparky</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>JE 助手</div>
        </div>
      </div>

      {/* 消息流：占满中间空间，向上滚 */}
      <div ref={scrollRef} style={messagesStyle}>
        {messages.map((m, i) => <Bubble key={i} role={m.role} text={m.text} />)}
      </div>

      {/* 底部：chip + 输入框 */}
      <div style={footerStyle}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <Chip label="批量上传" onClick={onBatchUpload} />
          <Chip label="评一个岗位" onClick={onSingleEval} />
          {evaluated.length > 0 && <Chip label="人岗匹配" onClick={onPersonJobMatch} />}
          {highCount > 0 && (
            <Chip label={`${highCount} 个高危异常`} onClick={() => send('查看异常')} highlight />
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(input); }}
            placeholder="问 Sparky 一句话..."
            style={inputStyle}
          />
          <button onClick={() => send(input)} disabled={!input.trim()} style={{
            ...sendBtnStyle,
            background: input.trim() ? BRAND : '#E2E8F0',
            color: input.trim() ? '#fff' : '#94A3B8',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
          }}>
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- 子组件 ----------

function Bubble({ role, text }: { role: 'sparky' | 'user'; text: string }) {
  const isSparky = role === 'sparky';
  return (
    <div style={{
      display: 'flex', justifyContent: isSparky ? 'flex-start' : 'flex-end',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '85%',
        padding: '8px 12px', borderRadius: 8,
        background: isSparky ? '#F8FAFC' : BRAND_TINT,
        border: isSparky ? '1px solid #F1F5F9' : `1px solid ${BRAND}33`,
        fontSize: 12.5, color: '#0F172A', lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </div>
  );
}

function Chip({ label, onClick, highlight }: { label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', fontSize: 11, borderRadius: 999,
      background: highlight ? BRAND : '#fff',
      color: highlight ? '#fff' : '#475569',
      border: `1px solid ${highlight ? BRAND : '#E2E8F0'}`,
      cursor: 'pointer', fontWeight: highlight ? 600 : 400,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

// ---------- 状态 → 开场白 ----------

function buildOpening(jobs: JeJob[], anomalies: JeAnomaly[]): string {
  const evaluated = jobs.filter(j => j.result?.job_grade != null);
  const high = anomalies.filter(a => a.severity === 'high').length;

  if (evaluated.length === 0) {
    return '你好，我是 Sparky。把岗位 JD 发给我，可以单个评，也可以批量上传 Excel 让我把整个组织的职级图谱跑出来。';
  }
  if (evaluated.length < 5) {
    return `已经评估了 ${evaluated.length} 个岗位。建议达到 10 个以上才能看出整个组织的职级分布特征 — 想继续上传，还是对现有岗位做调整？`;
  }
  const grades = evaluated.map(j => j.result!.job_grade!);
  const range = `G${Math.min(...grades)}-G${Math.max(...grades)}`;
  if (high > 0) {
    return `已评估 ${evaluated.length} 个岗位，分布在 ${range}。检测到 ${high} 个高危异常（多半是职级倒挂），需要先看一下。`;
  }
  return `已评估 ${evaluated.length} 个岗位，分布在 ${range}。当前没有高危异常 — 你可以继续上传新岗位、做人岗匹配，或点任一岗位看详情。`;
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
      return `打开「${found.title}」详情。评估解释 tab 里能看到 PK 推理 + 多解候选。`;
    }
    return `没找到包含「${target}」的岗位。可能拼写不一样，或者还没评估。`;
  }

  return '我能帮你：批量上传 / 单个评估 / 人岗匹配 / 查看异常。也可以说"解释 XXX 岗位"打开详情。';
}

// ---------- 样式 ----------

const containerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100%', width: '100%',
  background: '#fff',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '12px 16px', borderBottom: '1px solid #F1F5F9',
  display: 'flex', alignItems: 'center', gap: 10,
  flexShrink: 0,
};

const messagesStyle: React.CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '14px 16px',
  display: 'flex', flexDirection: 'column',
};

const footerStyle: React.CSSProperties = {
  padding: 12, borderTop: '1px solid #F1F5F9',
  flexShrink: 0,
  background: '#fff',
};

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '8px 12px', fontSize: 12.5,
  border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none',
  background: '#fff', fontFamily: 'inherit',
};

const sendBtnStyle: React.CSSProperties = {
  padding: '8px 16px', fontSize: 12, borderRadius: 8,
  border: 'none', fontWeight: 500,
  transition: 'background 0.12s',
};
