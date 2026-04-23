/**
 * JE 工具主组件：左 sidebar 岗位库 + 右主区评估视图。
 *
 * v1 范围：
 *  - 岗位库列表（按部门分组），高亮当前选中
 *  - 「+ 新增岗位」弹窗（基础信息 + JD → 后端同步评估 ~3-16s）
 *  - 评估视图：顶部岗位卡（标题/部门/职能/总分/职级） + 2 tabs
 *      [因子明细] 8 因子表格，HR 可下拉手改任一因子重算（不调 LLM）
 *      [JD 编辑]  改 JD 重新评估（会触发 LLM）
 *  - 删除岗位
 *
 * v2 待办：[对标] tab 同 workspace 内对比；[历史] tab 评估变更记录。
 */
import { useEffect, useState } from 'react';
import {
  jeListJobs, jeListFunctions, jeCreateJob, jeUpdateJd, jeUpdateFactors, jeDeleteJob,
  type JeJob,
} from '../api/client';

// ---- 8 因子合法档位（前端校验 & 下拉用，需与后端 enums.py 完全一致）----
const FACTOR_OPTIONS: Record<string, string[]> = {
  practical_knowledge: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+','I-','I','I+'],
  managerial_knowledge: ['T-','T','T+','I-','I','I+','II-','II','II+','III-','III','III+','IV-','IV','IV+','V-','V','V+','VI-','VI','VI+','VII-','VII','VII+','VIII-','VIII','VIII+','IX-','IX','IX+'],
  communication: ['1-','1','1+','2-','2','2+','3-','3','3+'],
  thinking_challenge: ['1-','1','1+','2-','2','2+','3-','3','3+','4-','4','4+','5-','5','5+'],
  thinking_environment: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+'],
  freedom_to_act: ['A-','A','A+','B-','B','B+','C-','C','C+','D-','D','D+','E-','E','E+','F-','F','F+','G-','G','G+','H-','H','H+','I-','I','I+'],
  magnitude: ['N','1-','1','1+','2-','2','2+','3-','3','3+','4-','4','4+','5-','5','5+'],
  nature_of_impact: ['I','II','III','IV','V','VI','R','C','S','P'],
};

const FACTOR_LABELS: Record<string, { name: string; group: 'KH' | 'PS' | 'ACC' }> = {
  practical_knowledge: { name: '专业知识 (PK)', group: 'KH' },
  managerial_knowledge: { name: '管理知识 (MK)', group: 'KH' },
  communication: { name: '沟通 (Comm)', group: 'KH' },
  thinking_challenge: { name: '思维挑战 (TC)', group: 'PS' },
  thinking_environment: { name: '思维环境 (TE)', group: 'PS' },
  freedom_to_act: { name: '行动自由度', group: 'ACC' },
  magnitude: { name: '影响范围', group: 'ACC' },
  nature_of_impact: { name: '影响性质', group: 'ACC' },
};

const FACTOR_ORDER = [
  'practical_knowledge', 'managerial_knowledge', 'communication',
  'thinking_challenge', 'thinking_environment',
  'freedom_to_act', 'magnitude', 'nature_of_impact',
];

// ---- Brand color: 跟随 WorkspaceShell 用 #D85A30 ----
const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

export default function JeApp() {
  const [jobs, setJobs] = useState<JeJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [functionCatalog, setFunctionCatalog] = useState<Record<string, string[]>>({});

  // 加载岗位库 + 职能字典
  useEffect(() => {
    Promise.all([jeListJobs(), jeListFunctions()])
      .then(([jobsRes, fnRes]) => {
        setJobs(jobsRes.data.jobs);
        setFunctionCatalog(fnRes.data.catalog);
        if (jobsRes.data.jobs.length > 0 && !selectedId) {
          setSelectedId(jobsRes.data.jobs[0].id);
        }
      })
      .catch(() => { /* 容错：留空 */ })
      .finally(() => setLoading(false));
  }, []);

  const selectedJob = jobs.find(j => j.id === selectedId) || null;

  const handleJobCreated = (job: JeJob) => {
    setJobs(prev => [job, ...prev]);
    setSelectedId(job.id);
    setShowNewModal(false);
  };

  const handleJobUpdated = (updated: JeJob) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('确认删除这个岗位？此操作不可撤销。')) return;
    try {
      await jeDeleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedId === jobId) {
        const remaining = jobs.filter(j => j.id !== jobId);
        setSelectedId(remaining[0]?.id || null);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* ---- 左 Sidebar：岗位库 ---- */}
      <Sidebar
        jobs={jobs}
        loading={loading}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNew={() => setShowNewModal(true)}
      />

      {/* ---- 右主区 ---- */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {loading ? (
          <CenterMsg>加载中...</CenterMsg>
        ) : !selectedJob ? (
          <EmptyState onNew={() => setShowNewModal(true)} />
        ) : (
          <JobDetail
            job={selectedJob}
            onUpdated={handleJobUpdated}
            onDelete={() => handleDelete(selectedJob.id)}
          />
        )}
      </div>

      {showNewModal && (
        <NewJobModal
          functionCatalog={functionCatalog}
          onClose={() => setShowNewModal(false)}
          onCreated={handleJobCreated}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sidebar：岗位库（按部门分组）
// ============================================================================
function Sidebar({ jobs, loading, selectedId, onSelect, onNew }: {
  jobs: JeJob[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  // 按部门分组
  const grouped: Record<string, JeJob[]> = {};
  jobs.forEach(j => {
    const dept = j.department || '未分组';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(j);
  });

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: '#fff', borderRight: '1px solid #E2E8F0',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '16px 20px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 12 }}>
          岗位库
          <span style={{ marginLeft: 8, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>
            {jobs.length} 个岗位
          </span>
        </div>
        <button onClick={onNew} style={primaryBtnStyle}>+ 新增岗位</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
        {loading ? (
          <div style={{ padding: 16, fontSize: 12, color: '#94A3B8' }}>加载中...</div>
        ) : jobs.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
            还没有岗位。<br />点上方按钮添加第一个岗位。
          </div>
        ) : (
          Object.entries(grouped).map(([dept, items]) => (
            <div key={dept} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#94A3B8', padding: '6px 10px', fontWeight: 500 }}>
                {dept}
              </div>
              {items.map(j => (
                <div key={j.id} onClick={() => onSelect(j.id)}
                  style={jobItemStyle(j.id === selectedId)}>
                  <div style={{ fontSize: 13, fontWeight: j.id === selectedId ? 600 : 500, color: '#0F172A' }}>
                    {j.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{j.function}</span>
                    {j.result?.job_grade != null && (
                      <span style={gradeBadgeStyle}>G{j.result.job_grade}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 空状态 / 引导新增第一个岗位
// ============================================================================
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
        岗位价值评估
      </div>
      <div style={{ fontSize: 13, color: '#64748B', marginBottom: 24, lineHeight: 1.7 }}>
        基于 Hay 体系评估岗位价值，输出 8 因子档位、三维子分、Hay 标准职级（9-27）。
        <br />粘贴 JD 即可一键评估，HR 可反向手改任一因子重算。
      </div>
      <button onClick={onNew} style={{ ...primaryBtnStyle, padding: '10px 24px', fontSize: 14 }}>
        + 添加第一个岗位
      </button>
    </div>
  );
}

// ============================================================================
// 岗位详情：顶部岗位卡 + 2 tabs（因子明细 / JD 编辑）
// ============================================================================
function JobDetail({ job, onUpdated, onDelete }: {
  job: JeJob;
  onUpdated: (j: JeJob) => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<'factors' | 'jd'>('factors');

  const grade = job.result?.job_grade;
  const total = job.result?.total_score;
  const kh = job.result?.kh_score;
  const ps = job.result?.ps_score;
  const acc = job.result?.acc_score;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* 顶部岗位卡 */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>
              {job.title}
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              {job.department || '未分组'} · {job.function}
            </div>
          </div>
          <button onClick={onDelete} style={ghostBtnStyle}>删除</button>
        </div>

        <div style={{ display: 'flex', gap: 32, marginTop: 24, paddingTop: 20, borderTop: '1px solid #F1F5F9' }}>
          <Stat label="总分" value={total} accent />
          <Stat label="Hay 职级" value={grade != null ? `G${grade}` : null} accent />
          <Stat label="Know-How" value={kh} />
          <Stat label="Problem Solving" value={ps} />
          <Stat label="Accountability" value={acc} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 16 }}>
        <Tab active={tab === 'factors'} onClick={() => setTab('factors')}>因子明细</Tab>
        <Tab active={tab === 'jd'} onClick={() => setTab('jd')}>JD 编辑</Tab>
      </div>

      {tab === 'factors' && <FactorTable job={job} onUpdated={onUpdated} />}
      {tab === 'jd' && <JdEditor job={job} onUpdated={onUpdated} />}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: accent ? 24 : 18, fontWeight: 700, color: accent ? BRAND : '#0F172A' }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '10px 16px', fontSize: 13, fontWeight: active ? 600 : 500,
      background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      color: active ? BRAND : '#64748B',
      borderBottom: active ? `2px solid ${BRAND}` : '2px solid transparent',
      marginBottom: -1,
    }}>
      {children}
    </button>
  );
}

// ============================================================================
// 因子明细：8 因子表格，每行支持下拉手改 → 自动重算
// ============================================================================
function FactorTable({ job, onUpdated }: { job: JeJob; onUpdated: (j: JeJob) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>(job.factors || {});
  const [saving, setSaving] = useState(false);

  // job 切换时同步 draft
  useEffect(() => { setDraft(job.factors || {}); }, [job.id]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(job.factors || {});

  const recompute = async () => {
    setSaving(true);
    try {
      const res = await jeUpdateFactors(job.id, draft);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`重算失败：${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setDraft(job.factors || {});

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          下拉任一因子档位，点「重算」立刻看到分数变化（不调 LLM，毫秒级）
        </div>
        {dirty && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={reset} style={ghostBtnStyle}>取消</button>
            <button onClick={recompute} disabled={saving} style={primaryBtnStyle}>
              {saving ? '重算中...' : '重算'}
            </button>
          </div>
        )}
      </div>

      <div>
        {(['KH', 'PS', 'ACC'] as const).map(group => (
          <div key={group}>
            <div style={{ padding: '8px 20px', fontSize: 11, color: '#94A3B8', background: '#FAFBFC',
              fontWeight: 500, letterSpacing: 0.5 }}>
              {group === 'KH' ? 'Know-How（知识技能）' :
               group === 'PS' ? 'Problem Solving（解决问题）' :
               'Accountability（职责）'}
            </div>
            {FACTOR_ORDER.filter(k => FACTOR_LABELS[k].group === group).map(k => (
              <div key={k} style={{
                padding: '12px 20px', borderBottom: '1px solid #F1F5F9',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1, fontSize: 13, color: '#0F172A' }}>
                  {FACTOR_LABELS[k].name}
                </div>
                <select
                  value={draft[k] || ''}
                  onChange={e => setDraft({ ...draft, [k]: e.target.value })}
                  style={selectStyle}
                >
                  {(FACTOR_OPTIONS[k] || []).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {draft[k] !== (job.factors || {})[k] && (
                  <span style={{ fontSize: 10, color: BRAND, fontWeight: 600 }}>已改</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// JD 编辑：改 JD 文本 → 重新走 LLM 评估
// ============================================================================
function JdEditor({ job, onUpdated }: { job: JeJob; onUpdated: (j: JeJob) => void }) {
  const [draft, setDraft] = useState(job.jd_text);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(job.jd_text); }, [job.id]);

  const dirty = draft.trim() !== job.jd_text.trim();

  const reEvaluate = async () => {
    if (!confirm('修改 JD 会触发 LLM 重新评估，约需 5-15 秒。确认？')) return;
    setSaving(true);
    try {
      const res = await jeUpdateJd(job.id, draft);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`评估失败：${e?.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
        修改 JD 后点「重新评估」会触发 LLM 重新抽取 PK 因子并刷新 8 因子和职级。
      </div>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={16}
        style={{
          width: '100%', padding: 12, fontSize: 13, lineHeight: 1.7,
          border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none',
          fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      {dirty && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setDraft(job.jd_text)} style={ghostBtnStyle}>取消</button>
          <button onClick={reEvaluate} disabled={saving} style={primaryBtnStyle}>
            {saving ? '评估中...' : '重新评估'}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 新增岗位 Modal
// ============================================================================
function NewJobModal({ functionCatalog, onClose, onCreated }: {
  functionCatalog: Record<string, string[]>;
  onClose: () => void;
  onCreated: (j: JeJob) => void;
}) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [func, setFunc] = useState('');
  const [jd, setJd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const allGroups = Object.keys(functionCatalog);

  const submit = async () => {
    setErr('');
    if (!title.trim()) return setErr('请填写岗位名称');
    if (!func) return setErr('请选择业务职能');
    if (!jd.trim()) return setErr('请粘贴 JD 文本');
    setSubmitting(true);
    try {
      const res = await jeCreateJob({
        title: title.trim(),
        function: func,
        department: department.trim() || undefined,
        jd_text: jd.trim(),
      });
      onCreated(res.data.job);
    } catch (e: any) {
      setErr(`评估失败：${e?.response?.data?.error || e.message}`);
      setSubmitting(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>
          新增岗位
        </div>

        {submitting ? (
          <SubmittingProgress />
        ) : (
          <>
            <FormRow label="岗位名称 *">
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="如：销售经理" style={inputStyle} />
            </FormRow>
            <FormRow label="部门">
              <input value={department} onChange={e => setDepartment(e.target.value)}
                placeholder="如：销售部" style={inputStyle} />
            </FormRow>
            <FormRow label="业务职能 *">
              <select value={func} onChange={e => setFunc(e.target.value)} style={inputStyle}>
                <option value="">— 选择职能 —</option>
                {allGroups.map(group => (
                  <optgroup key={group} label={group}>
                    {functionCatalog[group].map(fn => (
                      <option key={fn} value={fn}>{fn}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </FormRow>
            <FormRow label="岗位 JD *">
              <textarea value={jd} onChange={e => setJd(e.target.value)}
                placeholder="粘贴岗位职责 + 任职要求 + 团队规模 + 汇报关系等"
                rows={10}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </FormRow>

            {err && <div style={errStyle}>{err}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={onClose} style={ghostBtnStyle}>取消</button>
              <button onClick={submit} style={{ ...primaryBtnStyle, padding: '8px 20px' }}>
                开始评估
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SubmittingProgress() {
  const [step, setStep] = useState(0);
  const steps = [
    'LLM 提取专业知识档位...',
    '查询职能常模 + KH 收敛...',
    '精确反推 PS 组合...',
    '确定 ACC 因子 + 排序...',
    '生成最优方案 + 计算职级...',
  ];
  useEffect(() => {
    const timers = steps.map((_, i) => setTimeout(() => setStep(i + 1), (i + 1) * 2500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ padding: '32px 0' }}>
      <div style={{ fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 }}>
        正在评估岗位，约需 5-15 秒...
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360, margin: '0 auto' }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 12,
            color: i < step ? '#0F172A' : '#94A3B8',
          }}>
            <span>{i < step ? '✓' : i === step ? '⏳' : '○'}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 小工具组件 + style
// ============================================================================
function CenterMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#94A3B8', fontSize: 13 }}>
      {children}
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 14px', fontSize: 13, fontWeight: 600,
  background: BRAND, color: '#fff', border: 'none', borderRadius: 6,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
};
const ghostBtnStyle: React.CSSProperties = {
  padding: '7px 14px', fontSize: 13, fontWeight: 500,
  background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6,
  cursor: 'pointer', fontFamily: 'inherit',
};
const jobItemStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
  background: active ? BRAND_TINT : 'transparent',
  marginBottom: 2,
});
const gradeBadgeStyle: React.CSSProperties = {
  display: 'inline-block', padding: '1px 6px', fontSize: 10, fontWeight: 600,
  background: BRAND_TINT, color: BRAND, borderRadius: 4,
};
const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 6,
  background: '#fff', fontFamily: 'inherit', minWidth: 80, cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const errStyle: React.CSSProperties = {
  marginTop: 12, padding: '8px 12px', background: '#FEF2F2', color: '#991B1B',
  borderRadius: 6, fontSize: 12,
};
const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modalStyle: React.CSSProperties = {
  width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto',
  background: '#fff', borderRadius: 12, padding: 24,
  boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
};
