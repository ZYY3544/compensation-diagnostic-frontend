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
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  jeListJobs, jeListFunctions, jeCreateJob, jeUpdateJd, jeUpdateFactors, jeDeleteJob,
  jeListAnomalies, jeAdjustGrade,
  type JeJob, type JeAnomaly, type JeCandidate, type JeLibrary,
} from '../api/client';
import GradeMatrix from './GradeMatrix';
import BatchUpload from './BatchUpload';
import PersonJobMatch from './PersonJobMatch';
import JeSparkyChat from './JeSparkyChat';
import JeOnboarding from './JeOnboarding';
import JeEntryView, { type EntryPath } from './JeEntryView';
import SingleEvalView from './SingleEvalView';
import CompareLegacyModal from './CompareLegacyModal';
import CandidateBoard from './CandidateBoard';
import Workspace from '../components/layout/Workspace';
import { getLevelDefinition, getAdjacentDefinitions } from './hayDefinitions';
import { nextMsgId } from '../lib/msgId';

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

type ViewMode = 'entry' | 'single' | 'onboarding' | 'matrix' | 'detail' | 'match';

export default function JeApp() {
  const [jobs, setJobs] = useState<JeJob[]>([]);
  const [anomalies, setAnomalies] = useState<JeAnomaly[]>([]);
  const [library, setLibrary] = useState<JeLibrary | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 默认进 entry 入口选择页 — 用户从三个高频场景里选一条路径
  // (评一个 / 批量评 / 建立体系)。账户记忆功能开启时，已经走过流程的用户
  // 直接跳到 matrix 视图。
  const [view, setView] = useState<ViewMode>('entry');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [functionCatalog, setFunctionCatalog] = useState<Record<string, string[]>>({});
  // Sparky 辅助校准：保存岗位后比对前后 anomalies，新增的告警通过这个 prop 推到 chat
  const [sparkyAlert, setSparkyAlert] = useState<{ id: string; text: string } | null>(null);
  // 升级提示触发标记：单评路径累积到 5 个时提一次"要不要看图谱"，整个 session 只提一次
  const upgradeHintFiredRef = useRef(false);

  // 集中刷新：岗位列表 + 异常告警一起拉
  const refreshAll = useCallback(async () => {
    try {
      const [jobsRes, anomaliesRes] = await Promise.all([jeListJobs(), jeListAnomalies()]);
      setJobs(jobsRes.data.jobs);
      setAnomalies(anomaliesRes.data.anomalies);
    } catch {
      // 容错：留空
    }
  }, []);

  // 进入 JE 始终从空态开始 —— 历史记录功能（账户记忆）尚未启用。
  //
  // 设计原因：当前测试场景假设"用户第一次使用 JE"，每次刷新都展示完整的
  // 第一次旅程（Sparky 欢迎 + 右侧引导卡）。后端 jobs 表的数据保留不丢，
  // 后续做账户记忆功能时打开 jeListJobs / jeListAnomalies 调用即可恢复历史。
  // 职能字典是给"+ 单个评估"模态的下拉用，没历史的概念，正常加载。
  useEffect(() => {
    jeListFunctions().then(r => setFunctionCatalog(r.data.catalog)).catch(() => {});
  }, []);

  const selectedJob = jobs.find(j => j.id === selectedId) || null;

  // 通用岗位创建回调：把新岗位追加到 state，刷新异常告警，**不跳走视图**。
  // 从库批量勾选添加时多次调用，用户应该留在 matrix 看着岗位逐个出现。
  //
  // 副作用 1：拉新 anomalies 后跟当前对比，新增的告警让 Sparky 在 chat 里主动提醒。
  // 副作用 2：路径 A（单评）累积到 5 个岗位时触发一次"升级提示"
  //   → 措辞展示价值（"我可以帮你看看职级关系"）而非推销升级版。
  //   用 ref 标记只触发一次，避免每次评完都打扰。
  const handleJobCreated = (job: JeJob) => {
    setJobs(prev => {
      const next = [job, ...prev];
      maybeFireUpgradeHint(next);
      return next;
    });
    jeListAnomalies()
      .then(r => {
        const newAnomalies = r.data.anomalies;
        setAnomalies(prev => {
          const prevKeys = new Set(prev.map(a => `${a.type}|${a.message}`));
          const added = newAnomalies.filter(a => !prevKeys.has(`${a.type}|${a.message}`));
          if (added.length > 0) {
            const list = added.slice(0, 3).map(a => `· ${a.message}`).join('\n');
            const more = added.length > 3 ? `\n（还有 ${added.length - 3} 个，详见上方告警条）` : '';
            setSparkyAlert({
              id: nextMsgId(),
              text: `刚添加的「${job.title}」让图谱新增 ${added.length} 个异常：\n\n${list}${more}\n\n如果觉得是误报，可以直接忽略；如果合理，建议调整对应岗位的因子或职级。`,
            });
          }
          return newAnomalies;
        });
      })
      .catch(() => {});
  };

  // 单评路径累积到 5 个岗位时主动提一次"看图谱"
  const maybeFireUpgradeHint = (allJobs: JeJob[]) => {
    if (upgradeHintFiredRef.current) return;
    const singleCount = allJobs.filter(j => (j.result as any)?.source === 'single').length;
    if (singleCount < 5) return;
    upgradeHintFiredRef.current = true;
    setSparkyAlert({
      id: nextMsgId(),
      text: `你已经评了 ${singleCount} 个岗位了，我可以帮你看看它们之间的职级关系有没有问题（比如同级倒挂、跨部门膨胀这类）— 切到职级图谱视图就能看到全局分布。如果想做得更系统，告诉我"建立体系"我从访谈开始陪你跑一遍。`,
    });
  };

  // 矩阵拖拽：用户把岗位卡释放到另一个 cell → confirm + 调 PATCH /grade
  const handleDropToCell = useCallback(async (jobId: string, targetGrade: number, targetDepartment: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const currentGrade = job.result?.job_grade;
    const currentDept = job.department || '';
    if (currentGrade === targetGrade && currentDept === targetDepartment) {
      return;     // 拖回原 cell，noop
    }

    const gradeChanged = currentGrade !== targetGrade;
    const deptChanged = currentDept !== targetDepartment;
    const summary = [
      `准备调整「${job.title}」：`,
      gradeChanged ? `· 职级 G${currentGrade} → G${targetGrade}` : null,
      deptChanged ? `· 部门 ${currentDept || '未分组'} → ${targetDepartment}` : null,
      '',
      gradeChanged
        ? '系统会自动反推新的因子档位让职级匹配（一般调整 PK 或 MK）。结果跟拖到的位置可能差 1 级（取决于 Hay 档位的离散性）。'
        : '只调整部门归属，因子档位不变。',
      '',
      '确认调整吗？',
    ].filter(Boolean).join('\n');
    if (!confirm(summary)) return;

    try {
      const res = await jeAdjustGrade(jobId, targetGrade, deptChanged ? targetDepartment : undefined);
      handleJobUpdated(res.data.job);
      // 命中提示放到 chat 里：精确命中 / 偏差告知
      if (res.data.achieved === false && res.data.diff != null) {
        setSparkyAlert({
          id: nextMsgId(),
          text: `已经把「${job.title}」往 G${targetGrade} 方向调整了，但因为 Hay 档位是离散的，最终落在 G${(res.data.job.result || {}).job_grade}（差 ${res.data.diff > 0 ? '+' : ''}${res.data.diff} 级）。如果想精确控制可以进岗位详情页手改因子。`,
        });
      }
    } catch (e: any) {
      alert(`调整失败：${e?.response?.data?.error || e?.message || '未知错误'}`);
    }
  }, [jobs]);

  // 入口路径分发：从 JeEntryView 的三个 chip 或 chat 关键词触发
  const handleEntryChoice = (path: EntryPath) => {
    if (path === 'single') {
      // 路径 A：进 single view 全程左右分栏（替换之前的 modal 弹窗）
      setView('single');
    } else if (path === 'list') {
      setShowBatchModal(true);
    } else if (path === 'system') {
      setView('onboarding');
    }
  };

  // NewJobModal（旧的 JD 单评流程）专用：建完岗自动跳详情页
  // 阶段 3 把这个流程降级到岗位详情可选入口后，这个 handler 只剩一个调用方
  const handleSingleJobCreated = (job: JeJob) => {
    handleJobCreated(job);
    setSelectedId(job.id);
    setShowNewModal(false);
    setView('detail');
  };

  const handleJobUpdated = (updated: JeJob) => {
    setJobs(prev => prev.map(j => j.id === updated.id ? updated : j));
    jeListAnomalies().then(r => setAnomalies(r.data.anomalies)).catch(() => {});
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('确认删除这个岗位？此操作不可撤销。')) return;
    try {
      await jeDeleteJob(jobId);
      setJobs(prev => prev.filter(j => j.id !== jobId));
      if (selectedId === jobId) {
        setSelectedId(null);
        setView('matrix');
      }
      jeListAnomalies().then(r => setAnomalies(r.data.anomalies)).catch(() => {});
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedId(jobId);
    setView('detail');
  };

  const handleBatchComplete = async () => {
    // 批量评估完成 → 重新拉岗位 + 异常，留在矩阵视图
    await refreshAll();
    setView('matrix');
  };

  // 主视图：matrix 视图自带左右两栏（GradeMatrix 内部就是 chat + 工作台），
  // detail / match 视图独立全宽展示，原来的"岗位库 sidebar"已被 chat 替代，删掉。
  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {view === 'entry' ? (
          <JeEntryView onChoose={handleEntryChoice} />
        ) : view === 'single' ? (
          <SingleEvalView
            functionCatalog={functionCatalog}
            onJobCreated={handleJobCreated}
            onGoToMatrix={() => setView('matrix')}
            onBackToEntry={() => setView('entry')}
          />
        ) : view === 'onboarding' ? (
          <JeOnboarding
            onComplete={(_profile, library) => {
              setLibrary(library);          // 让 matrix 视图立刻能渲染岗位库面板
              setView('matrix');
            }}
          />
        ) : view === 'match' ? (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <PersonJobMatch
              onBack={() => setView('matrix')}
              onJobSelect={handleSelectJob}
            />
          </div>
        ) : view === 'matrix' ? (
          <GradeMatrix
            jobs={jobs}
            anomalies={anomalies}
            library={library}
            selectedJobId={selectedId}
            onJobSelect={handleSelectJob}
            onJobCreated={handleJobCreated}
            onBatchUpload={() => setShowBatchModal(true)}
            onSingleEval={() => setShowNewModal(true)}
            onPersonJobMatch={() => setView('match')}
            onCompareLegacy={() => setShowCompareModal(true)}
            onDropToCell={handleDropToCell}
            sparkyAlert={sparkyAlert}
          />
        ) : selectedJob ? (
          <DetailLayout
            job={selectedJob}
            jobs={jobs}
            anomalies={anomalies}
            onUpdated={handleJobUpdated}
            onDelete={() => handleDelete(selectedJob.id)}
            onBack={() => setView('matrix')}
            onBatchUpload={() => setShowBatchModal(true)}
            onSingleEval={() => setShowNewModal(true)}
            onPersonJobMatch={() => setView('match')}
            onJobByTitle={(title) => {
              const j = jobs.find(x => x.title === title);
              if (j) handleSelectJob(j.id);
            }}
            sparkyAlert={sparkyAlert}
          />
        ) : (
          <CenterMsg>岗位已删除或不存在</CenterMsg>
        )}
      </div>

      {showNewModal && (
        <NewJobModal
          functionCatalog={functionCatalog}
          onClose={() => setShowNewModal(false)}
          onCreated={handleSingleJobCreated}
        />
      )}
      {showBatchModal && (
        <BatchUpload
          onClose={() => setShowBatchModal(false)}
          onComplete={handleBatchComplete}
        />
      )}
      {showCompareModal && (
        <CompareLegacyModal
          onClose={() => setShowCompareModal(false)}
          onJobSelect={handleSelectJob}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sidebar：岗位库（按部门分组）+ 视图切换
// 当前主视图已改为左 chat + 右工作台两栏，原来的岗位库 sidebar 不再渲染。
// 函数保留供后续可能的 detail 视图侧栏复用，TypeScript noUnusedLocals 用占位引用绕过。
// ============================================================================
const _useSidebar = () => Sidebar;
void _useSidebar;
function Sidebar({ jobs, loading, selectedId, onSelect, onNew, onBackToMatrix, currentView }: {
  jobs: JeJob[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onBackToMatrix: () => void;
  currentView: ViewMode;
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
        <button
          onClick={onBackToMatrix}
          style={{
            ...primaryBtnStyle,
            width: '100%', marginBottom: 8,
            background: currentView === 'matrix' ? BRAND : '#fff',
            color: currentView === 'matrix' ? '#fff' : BRAND,
            border: `1px solid ${BRAND}`,
          }}
        >
          职级图谱
        </button>
        <button onClick={onNew} style={{ ...primaryBtnStyle, width: '100%' }}>+ 新增岗位</button>
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
// 岗位详情页布局：左 Sparky 对话 + 右 Workspace（wide 模式，黄金比例可拖拽）
// ============================================================================
function DetailLayout({
  job, jobs, anomalies, onUpdated, onDelete, onBack,
  onBatchUpload, onSingleEval, onPersonJobMatch, onJobByTitle,
  sparkyAlert,
}: {
  job: JeJob;
  jobs: JeJob[];
  anomalies: JeAnomaly[];
  onUpdated: (j: JeJob) => void;
  onDelete: () => void;
  onBack: () => void;
  onBatchUpload: () => void;
  onSingleEval: () => void;
  onPersonJobMatch: () => void;
  onJobByTitle: (title: string) => void;
  sparkyAlert?: { id: string; text: string } | null;
}) {
  const [showJdEditor, setShowJdEditor] = useState(false);

  return (
    <div style={{ display: 'flex', height: '100%', background: '#FAFAFA' }}>
      {/* 左：Sparky 对话 — 进入 detail 后开场用该岗位的 pk_reasoning */}
      <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', background: '#fff', borderRight: '1px solid var(--border, #E2E8F0)' }}>
        <JeSparkyChat
          jobs={jobs}
          anomalies={anomalies}
          currentJob={job}
          onBatchUpload={onBatchUpload}
          onSingleEval={onSingleEval}
          onPersonJobMatch={onPersonJobMatch}
          onJobByTitle={onJobByTitle}
          incomingAlert={sparkyAlert}
        />
      </div>

      {/* 右：Workspace 工作台（wide 模式默认 0.618 黄金比例，可拖拽分隔条） */}
      {/* 完全复用主诊断的 Workspace wide 模式：workspace 占黄金 0.618，
          chat flex:1 占剩余，左右两栏之间可拖拽分隔条调宽窄 */}
      <Workspace
        mode="wide"
        title={job.title}
        subtitle={`${job.department || '未分组'} · ${job.function}`}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={onBack} style={{
            padding: '4px 10px', fontSize: 11,
            background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 6,
            cursor: 'pointer', color: '#64748B',
          }}>
            ← 返回职级图谱
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowJdEditor(true)} style={ghostBtnStyle}>上传 JD 精细评估</button>
            <button onClick={onDelete} style={ghostBtnStyle}>删除岗位</button>
          </div>
        </div>

        <ConfidenceBanner job={job} onUploadJd={() => setShowJdEditor(true)} />

        <CandidateBoard job={job} onUpdated={onUpdated} />

        {showJdEditor && (
          <JdEditorModal
            job={job}
            onClose={() => setShowJdEditor(false)}
            onUpdated={(updated) => { onUpdated(updated); setShowJdEditor(false); }}
          />
        )}
      </Workspace>
    </div>
  );
}

// 详情页顶部的"评估深度"提示条 — 让用户一眼看到这个岗位的评估来源和置信度。
// 三种来源：library (从 AI 库选)、list (批量上传)、single (单评 JD)
// 置信度：仅 list 来源时才有 confidence 字段；library/single 默认置信度都高
function ConfidenceBanner({ job, onUploadJd }: { job: JeJob; onUploadJd: () => void }) {
  const result = (job.result || {}) as any;
  const source = result.source as 'library' | 'list' | 'single' | undefined;
  const confidence = result.confidence as 'high' | 'low' | undefined;

  // 路径 B 没 JD（lite 评估）→ 黄色提示，鼓励补 JD
  if (source === 'list' && confidence === 'low') {
    return (
      <div style={{
        padding: '10px 14px', marginBottom: 16,
        background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12, color: '#92400E',
      }}>
        <div>
          <strong>AI 推断结果</strong> — 这个岗位你只给了名称，没有 JD。结果是基于岗位名 + 职能推断的，置信度偏低。
        </div>
        <button onClick={onUploadJd} style={{
          padding: '5px 12px', fontSize: 11, borderRadius: 4,
          border: '1px solid #F59E0B', background: '#fff', color: '#92400E',
          cursor: 'pointer', fontWeight: 500, flexShrink: 0,
        }}>
          补 JD 重评
        </button>
      </div>
    );
  }
  // 从库选未改 → 灰色提示"待校准"
  if (source === 'library' && !result.verified) {
    return (
      <div style={{
        padding: '10px 14px', marginBottom: 16,
        background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8,
        fontSize: 12, color: '#475569',
      }}>
        <strong>AI 库推荐方案</strong> — 还未经你校准。看一遍下面的因子档位是否符合实际，调整任一档位即标"已校准"。
      </div>
    );
  }
  return null;
}


// JD 编辑 modal（替代原来的 JD 编辑 tab）
function JdEditorModal({ job, onClose, onUpdated }: {
  job: JeJob;
  onClose: () => void;
  onUpdated: (j: JeJob) => void;
}) {
  const [draft, setDraft] = useState(job.jd_text);
  const [saving, setSaving] = useState(false);
  const dirty = draft.trim() !== job.jd_text.trim();

  const reEvaluate = async () => {
    if (!confirm('修改 JD 会触发 LLM 重新评估，约需 5-15 秒。确认？')) return;
    setSaving(true);
    try {
      const res = await jeUpdateJd(job.id, draft);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`评估失败：${e?.response?.data?.error || e.message}`);
      setSaving(false);
    }
  };

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalStyle, maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 12 }}>
上传 JD 精细评估 —— {job.title}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
          粘贴或上传这个岗位的实际 JD，LLM 会基于 JD 重新抽取专业知识档位 + 收敛 8 因子。
          适用于：库里找不到合适基准、新兴 / 跨界岗位、对当前 AI 推荐的因子档位不确定时。
          评估结果会覆盖当前岗位档位（你之后还能在因子明细里手改）。
        </div>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={18}
          style={{
            width: '100%', padding: 12, fontSize: 13, lineHeight: 1.7,
            border: '1px solid #E2E8F0', borderRadius: 8, outline: 'none',
            fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtnStyle}>关闭</button>
          {dirty && (
            <button onClick={reEvaluate} disabled={saving} style={primaryBtnStyle}>
              {saving ? '评估中…' : '重新评估'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// 空状态 / 引导新增第一个岗位
// 注：JE 主视图改成职级图谱后，空态由 GradeMatrix 自己的 EmptyState 接管。
// 此函数保留供未来可能的弹窗引导复用，TypeScript 看到没引用会报 noUnusedLocals。
// _useEmptyState 这一行只是把它显式标成"有引用"，不会出现在产物里。
// ============================================================================
const _useEmptyState = () => EmptyState;
void _useEmptyState;
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
// 岗位详情（旧版）：顶部岗位卡 + 3 tabs。已被 DetailLayout + CandidateBoard 取代。
// 函数保留作占位（_useJobDetail holder）。
// ============================================================================
const _useJobDetail = () => JobDetail;
void _useJobDetail;
function JobDetail({ job, onUpdated, onDelete }: {
  job: JeJob;
  onUpdated: (j: JeJob) => void;
  onDelete: () => void;
}) {
  const candidates = job.result?.candidates || [];
  const hasExplanation = !!job.result?.pk_reasoning || candidates.length > 0;
  // 评估解释默认排第一，让 HR 先看推理再看因子
  const [tab, setTab] = useState<'reasoning' | 'factors' | 'jd'>(hasExplanation ? 'reasoning' : 'factors');

  // 切换岗位时重置 tab
  useEffect(() => {
    setTab(hasExplanation ? 'reasoning' : 'factors');
  }, [job.id, hasExplanation]);

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
        {hasExplanation && (
          <Tab active={tab === 'reasoning'} onClick={() => setTab('reasoning')}>评估解释</Tab>
        )}
        <Tab active={tab === 'factors'} onClick={() => setTab('factors')}>因子明细</Tab>
        <Tab active={tab === 'jd'} onClick={() => setTab('jd')}>JD 编辑</Tab>
      </div>

      {tab === 'reasoning' && <ReasoningPanel job={job} onUpdated={onUpdated} />}
      {tab === 'factors' && <FactorTable job={job} onUpdated={onUpdated} />}
      {tab === 'jd' && <JdEditor job={job} onUpdated={onUpdated} />}
    </div>
  );
}

// ============================================================================
// 评估解释：Sparky 风格的推理叙述 + 多解候选选择
// ============================================================================
function ReasoningPanel({ job, onUpdated }: { job: JeJob; onUpdated: (j: JeJob) => void }) {
  const reasoning = job.result?.pk_reasoning || '';
  const candidates = job.result?.candidates || [];
  const currentFactors = job.factors || {};
  const [applying, setApplying] = useState<number | null>(null);

  const applyCandidate = async (candidate: JeCandidate, idx: number) => {
    if (!confirm('采用这套候选方案？8 因子会被覆盖为该方案。')) return;
    setApplying(idx);
    try {
      const res = await jeUpdateFactors(job.id, candidate.factors);
      onUpdated(res.data.job);
    } catch (e: any) {
      alert(`应用失败：${e?.response?.data?.error || e.message}`);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Sparky 推理气泡 */}
      {reasoning && (
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
          padding: 20, display: 'flex', gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, flexShrink: 0,
            borderRadius: 8, background: BRAND_TINT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: BRAND,
          }}>
            S
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>
              Sparky · 评估推理
            </div>
            <div style={{ fontSize: 13, color: '#0F172A', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {reasoning}
            </div>
          </div>
        </div>
      )}

      {/* 多解候选 */}
      {candidates.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 8 }}>
            候选方案（{candidates.length} 套）
          </div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 1.6 }}>
            按职级和岗位倾向去重后挑选。当前选用：第一套（最高匹配度）。点"采用此方案"切换到其他候选。
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(candidates.length, 3)}, 1fr)`, gap: 12 }}>
            {candidates.map((c, i) => {
              const isCurrent = factorsEqual(c.factors, currentFactors);
              return (
                <CandidateCard
                  key={i}
                  candidate={c}
                  isCurrent={isCurrent}
                  applying={applying === i}
                  onApply={() => applyCandidate(c, i)}
                  index={i}
                  totalCandidates={candidates.length}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate, isCurrent, applying, onApply, index, totalCandidates }: {
  candidate: JeCandidate;
  isCurrent: boolean;
  applying: boolean;
  onApply: () => void;
  index: number;
  totalCandidates: number;
}) {
  const dominantColor = candidate.dominant === 'KH' ? '#4F46E5'
    : candidate.dominant === 'PS' ? '#0EA5E9'
    : candidate.dominant === 'ACC' ? '#F59E0B'
    : '#94A3B8';
  const recommended = index === 0;

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${isCurrent ? BRAND : '#E2E8F0'}`,
      borderTop: `3px solid ${dominantColor}`,
      borderRadius: 10, padding: 16,
      position: 'relative',
      boxShadow: isCurrent ? `0 0 0 2px ${BRAND_TINT}` : 'none',
    }}>
      {recommended && (
        <div style={{
          position: 'absolute', top: -10, right: 12,
          padding: '2px 10px', background: BRAND, color: '#fff',
          fontSize: 10, fontWeight: 600, borderRadius: 4,
        }}>
          Sparky 推荐
        </div>
      )}

      <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
        方案 {String.fromCharCode(65 + index)} {totalCandidates > 1 && `/ 共 ${totalCandidates} 套`}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#0F172A' }}>
          G{candidate.job_grade}
        </span>
        <span style={{ fontSize: 13, color: '#64748B' }}>
          {candidate.total_score} 分
        </span>
      </div>

      <div style={{ fontSize: 11, color: dominantColor, fontWeight: 500, marginBottom: 12 }}>
        {candidate.dominant} 主导{candidate.orientation && ` · ${candidate.orientation}`}
        {candidate.profile && ` · ${candidate.profile}`}
      </div>

      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', justifyContent: 'space-between', marginBottom: 12, lineHeight: 1.6 }}>
        <span>KH {candidate.kh_score}</span>
        <span>PS {candidate.ps_score}</span>
        <span>ACC {candidate.acc_score}</span>
      </div>

      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 4 }}>8 因子档位</div>
        <div style={{ fontSize: 11, color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          <span>PK <strong style={{ color: '#0F172A' }}>{candidate.factors.practical_knowledge}</strong></span>
          <span>MK <strong style={{ color: '#0F172A' }}>{candidate.factors.managerial_knowledge}</strong></span>
          <span>Comm <strong style={{ color: '#0F172A' }}>{candidate.factors.communication}</strong></span>
          <span>TC <strong style={{ color: '#0F172A' }}>{candidate.factors.thinking_challenge}</strong></span>
          <span>TE <strong style={{ color: '#0F172A' }}>{candidate.factors.thinking_environment}</strong></span>
          <span>FTA <strong style={{ color: '#0F172A' }}>{candidate.factors.freedom_to_act}</strong></span>
          <span>Mag <strong style={{ color: '#0F172A' }}>{candidate.factors.magnitude}</strong></span>
          <span>NoI <strong style={{ color: '#0F172A' }}>{candidate.factors.nature_of_impact}</strong></span>
        </div>
      </div>

      {isCurrent ? (
        <div style={{
          padding: '6px 0', textAlign: 'center', fontSize: 12, color: BRAND, fontWeight: 600,
        }}>
          ✓ 当前采用
        </div>
      ) : (
        <button onClick={onApply} disabled={applying} style={{
          width: '100%', padding: '6px 0', borderRadius: 6,
          background: applying ? '#E2E8F0' : '#fff',
          color: applying ? '#94A3B8' : BRAND,
          border: `1px solid ${BRAND}`,
          fontSize: 12, fontWeight: 500, cursor: applying ? 'wait' : 'pointer',
        }}>
          {applying ? '应用中...' : '采用此方案'}
        </button>
      )}
    </div>
  );
}

function factorsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = ['practical_knowledge', 'managerial_knowledge', 'communication',
    'thinking_challenge', 'thinking_environment',
    'freedom_to_act', 'magnitude', 'nature_of_impact'];
  return keys.every(k => a[k] === b[k]);
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
              <FactorRow
                key={k}
                factorKey={k}
                label={FACTOR_LABELS[k].name}
                value={draft[k] || ''}
                originalValue={(job.factors || {})[k]}
                onChange={v => setDraft({ ...draft, [k]: v })}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 单个因子行：当前档+上下相邻档默认展开 Hay 定义；下拉项 hover 浮出该档定义
// ============================================================================
function FactorRow({ factorKey, label, value, originalValue, onChange }: {
  factorKey: string;
  label: string;
  value: string;
  originalValue: string | undefined;
  onChange: (v: string) => void;
}) {
  const [hoverLevel, setHoverLevel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const adjacent = getAdjacentDefinitions(factorKey, value);
  const hoverDef = hoverLevel ? getLevelDefinition(factorKey, hoverLevel) : null;
  const dirty = value !== originalValue;

  return (
    <div style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13, color: '#0F172A' }}>
          {label}
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              marginLeft: 8, fontSize: 11, color: '#64748B',
              background: 'transparent', border: 'none', cursor: 'pointer',
              padding: 0,
            }}
            title="展开 / 收起 Hay 标准定义"
          >
            {expanded ? '收起说明' : '查看说明'}
          </button>
        </div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          onMouseOver={e => setHoverLevel((e.target as HTMLSelectElement).value)}
          onMouseLeave={() => setHoverLevel(null)}
          style={selectStyle}
        >
          {(FACTOR_OPTIONS[factorKey] || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {dirty && <span style={{ fontSize: 10, color: BRAND, fontWeight: 600 }}>已改</span>}
      </div>

      {/* hover 浮层：显示当前 select 元素鼠标悬停档位的完整定义 */}
      {hoverDef && hoverDef.level !== value.replace(/[+-]$/, '') && (
        <div style={{
          margin: '0 20px 12px', padding: '10px 12px',
          background: '#F8FAFC', borderLeft: `3px solid ${BRAND}`, borderRadius: 6,
          fontSize: 12, color: '#475569', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#0F172A' }}>{hoverDef.level} · {hoverDef.label}</strong>
          <div style={{ marginTop: 4 }}>{hoverDef.description}</div>
        </div>
      )}

      {/* 展开态：显示当前档 + 上下相邻档对比 */}
      {expanded && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(['prev', 'current', 'next'] as const).map(slot => {
            const def = adjacent[slot];
            if (!def) return null;
            const isCurrent = slot === 'current';
            return (
              <div key={slot} style={{
                padding: '10px 12px',
                background: isCurrent ? '#FEF7F4' : '#F8FAFC',
                borderLeft: `3px solid ${isCurrent ? BRAND : '#CBD5E1'}`,
                borderRadius: 6,
                fontSize: 12, color: '#475569', lineHeight: 1.6,
              }}>
                <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 2 }}>
                  {slot === 'prev' ? '上一档' : slot === 'current' ? '当前档' : '下一档'}
                </div>
                <strong style={{ color: '#0F172A' }}>{def.level} · {def.label}</strong>
                <div style={{ marginTop: 4 }}>{def.description}</div>
              </div>
            );
          })}
        </div>
      )}
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
