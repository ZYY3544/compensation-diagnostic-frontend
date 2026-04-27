/**
 * 职级图谱主视图（v3 左右两栏布局）。
 *
 * v3 相比 v2 的关键变化：
 *  - 改成左右两栏：左 Sparky 对话（固定宽度 380）+ 右工作台（flex），
 *    跟主诊断的"左对话 + 右工作台"范式一致
 *  - 左侧 chat 占满高度，输入框沉底，对话历史向上滚
 *  - 右侧工作台分三段：异常告警 → 标题栏 → 矩阵/列表
 *
 * 状态切换：
 *  - 完全空 / 仍在评估 → 整页只有左 chat（右侧给空态引导）
 *  - 1-4 个岗位 → 右侧用卡片列表（密度低，空格不刺眼）
 *  - ≥ 5 个岗位 → 右侧用矩阵（X 部门/职能、Y 职级）
 */
import { useMemo, useState } from 'react';
import type { JeJob, JeAnomaly, JeLibrary, JeOrgProfile } from '../api/client';
import JeSparkyChat from './JeSparkyChat';
import LibraryPanel from './LibraryPanel';
import Workspace from '../components/layout/Workspace';
import { NotesView } from './JeOnboarding';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';
const NEUTRAL = '#94A3B8';

const SPARSE_THRESHOLD = 10;
const MATRIX_MIN_JOBS = 5;

interface Props {
  jobs: JeJob[];
  anomalies: JeAnomaly[];
  library: JeLibrary | null;
  /** 路径 C 访谈过的组织画像;没访谈过为 null,'访谈笔记'按钮就隐藏 */
  profile: JeOrgProfile | null;
  onJobSelect: (jobId: string) => void;
  onJobCreated: (job: JeJob) => void;
  onBatchUpload: () => void;
  onSingleEval: () => void;
  onPersonJobMatch: () => void;
  onCompareLegacy: () => void;
  /** 拖拽职级调整：父组件实现 confirm dialog + 调端点 + 更新 jobs state */
  onDropToCell?: (jobId: string, targetGrade: number, targetDepartment: string) => void;
  selectedJobId?: string | null;
  sparkyAlert?: { id: string; text: string } | null;
}

type AxisMode = 'department' | 'function';

export default function GradeMatrix({
  jobs, anomalies, library, profile, onJobSelect, onJobCreated, onBatchUpload, onSingleEval, onPersonJobMatch, onCompareLegacy, onDropToCell, selectedJobId, sparkyAlert,
}: Props) {
  const [axisMode, setAxisMode] = useState<AxisMode>('department');
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  const evaluated = useMemo(
    () => jobs.filter(j => j.result?.job_grade != null),
    [jobs],
  );

  const handleJobByTitle = (title: string) => {
    const j = jobs.find(x => x.title === title);
    if (j) onJobSelect(j.id);
  };

  const useMatrix = evaluated.length >= MATRIX_MIN_JOBS;

  // 复用主诊断的 Workspace 组件 → chat flex:1 占剩余 + workspace wide 黄金 0.618
  // 跟主诊断 wide 模式完全一致；用户可拖拽分隔条调整宽度
  const wsTitle = useMatrix ? '职级图谱' : evaluated.length > 0 ? '岗位列表' : (jobs.length === 0 ? '开始评估' : '评估中');
  return (
    <div style={{
      display: 'flex', height: '100%',
      background: '#FAFAFA',
    }}>
      {/* ---- 左：Sparky 对话区（flex:1 占剩余） ---- */}
      <div style={{
        flex: 1, minWidth: 0,
        borderRight: '1px solid #E2E8F0', background: '#fff',
        display: 'flex', flexDirection: 'column',
        height: '100%', overflow: 'hidden',
      }}>
        <JeSparkyChat
          jobs={jobs}
          anomalies={anomalies}
          onBatchUpload={onBatchUpload}
          onSingleEval={onSingleEval}
          onPersonJobMatch={onPersonJobMatch}
          onJobByTitle={handleJobByTitle}
          incomingAlert={sparkyAlert}
        />
      </div>

      {/* ---- 右：Workspace（wide 黄金，可拖拽） ---- */}
      <Workspace mode="wide" title={wsTitle} subtitle={evaluated.length > 0 ? `${evaluated.length} 个岗位` : undefined}>
        {/* AI 岗位库面板 — 叠加在矩阵上方，可折叠。访谈完成后 library 才有值 */}
        {library && library.entries.length > 0 && (
          <LibraryPanel library={library} jobs={jobs} onJobCreated={onJobCreated} defaultOpen={evaluated.length === 0} />
        )}

        {jobs.length === 0 && !library ? (
          <RightEmptyHint onBatchUpload={onBatchUpload} onSingleEval={onSingleEval} />
        ) : evaluated.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            从上方 AI 岗位库勾选岗位添加，或者直接告诉 Sparky 你需要什么岗位
          </div>
        ) : (
          <>
            {anomalies.length > 0 && <AnomalyBar anomalies={anomalies} onJobSelect={onJobSelect} />}

            {/* 主路径改成"从 AI 库选岗"后，矩阵右上不再出现"批量上传"主 CTA。
                只留：X 轴切换 + "对照现行体系"（评估完成后高频需求）。
                批量上传 / 单评 JD 等次要操作通过 Sparky chat 的 chip 触发（保留兜底）。 */}
            <div style={{
              display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12, gap: 8,
            }}>
              {profile && (
                <button onClick={() => setShowNotesDrawer(true)} style={ghostBtn}>
                  访谈笔记
                </button>
              )}
              <button onClick={onCompareLegacy} style={ghostBtn}>对照现行体系</button>
              {useMatrix && <AxisToggle mode={axisMode} onChange={setAxisMode} />}
            </div>

            {useMatrix
              ? <Matrix evaluated={evaluated} axisMode={axisMode} selectedJobId={selectedJobId} onJobSelect={onJobSelect} onDropToCell={onDropToCell} />
              : <CardList evaluated={evaluated} selectedJobId={selectedJobId} onJobSelect={onJobSelect} />
            }

            {evaluated.length < SPARSE_THRESHOLD && (
              <div style={{
                marginTop: 12, fontSize: 11, color: '#94A3B8', textAlign: 'center',
              }}>
                已评估 {evaluated.length} / 建议 {SPARSE_THRESHOLD} 个 — 数据更多时图谱才能反映完整组织结构
              </div>
            )}
          </>
        )}
      </Workspace>

      {/* 访谈笔记 Drawer — 路径 C 走过访谈的用户随时回看组织画像 */}
      {showNotesDrawer && profile && (
        <NotesDrawer profile={profile} onClose={() => setShowNotesDrawer(false)} />
      )}
    </div>
  );
}

function NotesDrawer({ profile, onClose }: {
  profile: JeOrgProfile;
  onClose: () => void;
}) {
  // 把 JeOrgProfile 转成 NotesView 期待的 Partial 形状
  // (profile.industry / headcount 直接对得上;company_profile_md 是 onboarding
  //  阶段 LLM 给的丰富 markdown,这里没存所以为 undefined,展示 industry+headcount tag 就够)
  const partialForNotes = {
    industry: profile.industry || undefined,
    headcount: profile.headcount ?? undefined,
    departments: profile.departments || [],
    layers: profile.layers || [],
    existing_grade_system: profile.existing_grade_system,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
        zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#FAFAFA', width: 520, maxWidth: '90vw', height: '100%',
          padding: '24px 28px', overflowY: 'auto',
          boxShadow: '-8px 0 32px rgba(15,23,42,0.15)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#0F172A' }}>访谈笔记</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              路径 C 组织访谈收集的关键信息,用于生成推荐岗位库
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px 10px', border: '1px solid #E2E8F0', background: '#fff',
              borderRadius: 6, cursor: 'pointer', fontSize: 12, color: '#475569',
            }}
          >关闭</button>
        </div>
        <NotesView profile={partialForNotes} stage="interview" errorText={null} />
      </div>
    </div>
  );
}

// ============================================================================
// 右侧空态引导：用户第一次进 JE 时看到的"开始页"
// 三段：标题 + 流程示意 + 双 CTA。让用户在没有任何岗位数据时也能理解
// 这个工具能干什么、第一步该做什么。
// ============================================================================
function RightEmptyHint({ onBatchUpload, onSingleEval }: {
  onBatchUpload: () => void;
  onSingleEval: () => void;
}) {
  return (
    <div style={{ padding: '24px 0', maxWidth: 520, margin: '0 auto' }}>
      {/* 标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
          开始你的第一次岗位评估
        </div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7 }}>
          基于 Hay 方法论，输出 Know-How / Problem Solving / Accountability 三维评分 + 标准职级。
          引擎只调一次 LLM 提取专业知识档位，其余 7 个因子全部由规则推导。
        </div>
      </div>

      {/* 三步流程示意 */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        marginBottom: 24,
      }}>
        <FlowStep n={1} title="单评 / 批量上传" desc="粘贴 JD 或上传 Excel" />
        <FlowStep n={2} title="自动评估" desc="LLM + 规则收敛" />
        <FlowStep n={3} title="职级图谱" desc="多解可调，异常告警" />
      </div>

      {/* 双 CTA */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 16 }}>
        <button onClick={onSingleEval} style={{ ...ghostBtn, padding: '10px 20px', fontSize: 13 }}>
          评一个岗位
        </button>
        <button onClick={onBatchUpload} style={{ ...primaryBtn, padding: '10px 20px', fontSize: 13 }}>
          批量上传 JD 表
        </button>
      </div>

      {/* 提示 */}
      <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.7 }}>
        建议至少评估 10 个岗位才能看到完整的职级分布特征。
        <br />评估完成后还能切到"人岗匹配"视图看员工跟岗位的对应关系。
      </div>
    </div>
  );
}

function FlowStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
      padding: 14, textAlign: 'center',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: BRAND_TINT, color: BRAND,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, marginBottom: 8,
      }}>
        {n}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

// ============================================================================
// 卡片列表（岗位 < 5 时用）
// ============================================================================
function CardList({ evaluated, selectedJobId, onJobSelect }: {
  evaluated: JeJob[];
  selectedJobId?: string | null;
  onJobSelect: (id: string) => void;
}) {
  const byDept: Record<string, JeJob[]> = {};
  evaluated.forEach(j => {
    const dept = j.department || '未分组';
    (byDept[dept] ||= []).push(j);
  });

  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 16 }}>
      {Object.entries(byDept).map(([dept, items]) => (
        <div key={dept} style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 11, color: '#94A3B8', fontWeight: 500,
            paddingBottom: 6, marginBottom: 8, borderBottom: '1px dashed #F1F5F9',
          }}>
            {dept} · {items.length}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {items.map(j => <JobCard key={j.id} job={j} selected={j.id === selectedJobId} onClick={() => onJobSelect(j.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function JobCard({ job, selected, onClick }: { job: JeJob; selected: boolean; onClick: () => void }) {
  const dom = pickDominant(job);
  const grade = job.result?.job_grade;
  const total = job.result?.total_score;

  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
      background: selected ? BRAND_TINT : '#fff',
      border: `1px solid ${selected ? BRAND : '#E2E8F0'}`,
      borderLeft: `3px solid ${dom.color}`,
      transition: 'all 0.12s',
    }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.background = '#FAFAFA'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: selected ? 600 : 500 }}>
          {job.title}
        </div>
        {grade != null && (
          <div style={{ fontSize: 13, color: BRAND, fontWeight: 700 }}>G{grade}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
        {dom.label} 主导{total != null && ` · ${total} 分`}
      </div>
    </div>
  );
}

// ============================================================================
// 矩阵（岗位 ≥ 5 时用）
// ============================================================================
function Matrix({ evaluated, axisMode, selectedJobId, onJobSelect, onDropToCell }: {
  evaluated: JeJob[];
  axisMode: AxisMode;
  selectedJobId?: string | null;
  onJobSelect: (id: string) => void;
  /**
   * 拖拽回调：用户把岗位卡释放在另一个 cell 上时触发。
   * 仅 axisMode='department' 模式下启用 — 跨职能列拖拽改 function 没语义。
   */
  onDropToCell?: (jobId: string, targetGrade: number, targetDepartment: string) => void;
}) {
  const labelKey = axisMode === 'department'
    ? (j: JeJob) => j.department || '未分组'
    : (j: JeJob) => j.function || '未知';

  const labels = new Set<string>();
  let minG = Infinity, maxG = -Infinity;
  const cells: Record<string, JeJob[]> = {};

  for (const j of evaluated) {
    const grade = j.result!.job_grade!;
    const lab = labelKey(j);
    labels.add(lab);
    minG = Math.min(minG, grade);
    maxG = Math.max(maxG, grade);
    const k = `${lab}::${grade}`;
    (cells[k] ||= []).push(j);
  }

  const axisLabels = Array.from(labels).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const grades: number[] = [];
  for (let g = maxG; g >= minG; g--) grades.push(g);

  const dragEnabled = axisMode === 'department' && !!onDropToCell;
  const [hoverCell, setHoverCell] = useState<string | null>(null);

  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: 16, overflowX: 'auto',
    }}>
      <table style={{
        borderCollapse: 'separate', borderSpacing: 0,
        width: '100%', minWidth: axisLabels.length * 160 + 60,
      }}>
        <thead>
          <tr>
            <th style={{ ...thBase, width: 50, textAlign: 'right', paddingRight: 12 }} />
            {axisLabels.map(lab => (
              <th key={lab} style={thBase}>{lab}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grades.map(g => (
            <tr key={g}>
              <td style={gradeColStyle}>G{g}</td>
              {axisLabels.map(lab => {
                const k = `${lab}::${g}`;
                const cellJobs = cells[k] || [];
                const isHover = hoverCell === k;
                return (
                  <td
                    key={lab}
                    style={{
                      ...cellTdStyle,
                      background: isHover ? BRAND_TINT : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onDragOver={dragEnabled ? (e) => { e.preventDefault(); setHoverCell(k); } : undefined}
                    onDragLeave={dragEnabled ? () => setHoverCell(prev => prev === k ? null : prev) : undefined}
                    onDrop={dragEnabled ? (e) => {
                      e.preventDefault();
                      setHoverCell(null);
                      const jobId = e.dataTransfer.getData('text/plain');
                      if (jobId) onDropToCell!(jobId, g, lab);
                    } : undefined}
                  >
                    {cellJobs.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {cellJobs.map(j => (
                          <CellCard
                            key={j.id}
                            job={j}
                            selected={j.id === selectedJobId}
                            draggable={dragEnabled}
                            onClick={() => onJobSelect(j.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{ minHeight: 36 }} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {dragEnabled && (
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10, textAlign: 'center' }}>
          提示：拖拽岗位卡到其他职级行可以快速调整 — 系统会自动反推因子档位
        </div>
      )}
    </div>
  );
}

function CellCard({ job, selected, onClick, draggable }: { job: JeJob; selected: boolean; onClick: () => void; draggable?: boolean }) {
  const dom = pickDominant(job);
  const total = job.result?.total_score;

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? (e) => {
        e.dataTransfer.setData('text/plain', job.id);
        e.dataTransfer.effectAllowed = 'move';
      } : undefined}
      title={`${job.title} · ${dom.label} 主导 · ${total ?? '—'} 分${draggable ? '（可拖拽）' : ''}`}
      style={{
        padding: '6px 8px',
        background: selected ? BRAND_TINT : '#fff',
        border: `1px solid ${selected ? BRAND : '#E2E8F0'}`,
        borderLeft: `3px solid ${dom.color}`,
        borderRadius: 6,
        cursor: draggable ? 'grab' : 'pointer',
        fontSize: 12, color: '#0F172A',
        fontWeight: selected ? 600 : 400,
      }}
      onMouseOver={e => { if (!selected) e.currentTarget.style.background = '#FAFAFA'; }}
      onMouseOut={e => { if (!selected) e.currentTarget.style.background = '#fff'; }}
    >
      <div>{job.title}</div>
    </div>
  );
}

function pickDominant(job: JeJob): { color: string; label: string } {
  const kh = job.result?.kh_score || 0;
  const ps = job.result?.ps_score || 0;
  const acc = job.result?.acc_score || 0;
  const total = kh + ps + acc;
  if (total === 0) return { color: NEUTRAL, label: '—' };
  const max = Math.max(kh, ps, acc);
  if (max === kh) return { color: KH_COLOR, label: 'KH' };
  if (max === ps) return { color: PS_COLOR, label: 'PS' };
  return { color: ACC_COLOR, label: 'ACC' };
}

// ============================================================================
// 异常告警条
// ============================================================================
function AnomalyBar({ anomalies, onJobSelect }: { anomalies: JeAnomaly[]; onJobSelect: (id: string) => void }) {
  const high = anomalies.filter(a => a.severity === 'high').length;
  const [expanded, setExpanded] = useState(high > 0);
  const medium = anomalies.filter(a => a.severity === 'medium').length;
  const low = anomalies.filter(a => a.severity === 'low').length;

  return (
    <div style={{
      background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10,
      padding: '10px 14px', marginBottom: 12,
    }}>
      <div onClick={() => setExpanded(e => !e)} style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
      }}>
        <div style={{ fontSize: 12, color: '#0F172A' }}>
          检测到 <strong>{anomalies.length}</strong> 个异常
          <span style={{ marginLeft: 10, fontSize: 11, color: '#64748B' }}>
            {high > 0 && <span style={{ color: '#DC2626', marginRight: 6 }}>高 {high}</span>}
            {medium > 0 && <span style={{ color: '#D97706', marginRight: 6 }}>中 {medium}</span>}
            {low > 0 && <span style={{ color: '#94A3B8' }}>低 {low}</span>}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#64748B' }}>{expanded ? '收起' : '展开'}</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px solid #FED7AA', paddingTop: 10 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '6px 0',
              borderBottom: i < anomalies.length - 1 ? '1px dashed #FED7AA' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: a.severity === 'high' ? '#DC2626'
                    : a.severity === 'medium' ? '#D97706' : '#94A3B8',
                  display: 'inline-block',
                }} />
                <strong style={{ color: '#0F172A' }}>{a.title}</strong>
              </div>
              <div style={{ color: '#64748B', marginLeft: 14 }}>{a.message}</div>
              {a.evidence.length > 0 && (
                <div style={{ marginTop: 4, marginLeft: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {a.evidence.map(jobId => (
                    <button key={jobId} onClick={() => onJobSelect(jobId)} style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 3,
                      border: '1px solid #FED7AA', background: '#fff', color: BRAND, cursor: 'pointer',
                    }}>
                      查看
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 共享小组件 + 样式
// ============================================================================
function AxisToggle({ mode, onChange }: { mode: AxisMode; onChange: (m: AxisMode) => void }) {
  return (
    <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 6, padding: 2 }}>
      {(['department', 'function'] as const).map(m => (
        <button key={m} onClick={() => onChange(m)} style={{
          padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer', borderRadius: 4,
          background: mode === m ? '#fff' : 'transparent',
          color: mode === m ? '#0F172A' : '#64748B',
          fontWeight: mode === m ? 600 : 400,
        }}>
          {m === 'department' ? '按部门' : '按职能'}
        </button>
      ))}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: 'none',
  background: BRAND, color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 6, border: '1px solid #E2E8F0',
  background: '#fff', color: '#475569', fontSize: 12, cursor: 'pointer',
};

const thBase: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: '#64748B',
  padding: '6px 6px', textAlign: 'left',
  borderBottom: '1px solid #E2E8F0',
};

const gradeColStyle: React.CSSProperties = {
  fontSize: 11, fontFamily: 'ui-monospace, monospace',
  textAlign: 'right', paddingRight: 12, paddingTop: 6, paddingBottom: 6,
  borderRight: '1px solid #F1F5F9', verticalAlign: 'top',
  color: '#64748B',
};

const cellTdStyle: React.CSSProperties = {
  padding: 5, verticalAlign: 'top', minWidth: 140,
  borderBottom: '1px dashed #F1F5F9',
};
