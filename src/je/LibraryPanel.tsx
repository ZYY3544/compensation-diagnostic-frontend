/**
 * 标准岗位库面板 — 用户从这里挑岗位添加到自己的图谱里。
 *
 * 数据源:JeProfile.library_data (来自 standard_libraries/<行业>.json,
 * 不再调 LLM 实时生成)。
 *
 * 交互简化:
 *   · 搜索框 fuzzy 匹配 name/department/function/sub_function
 *   · 按部门分组展示,每行紧凑展示 name + Hay 职级 + 一句话亮点
 *   · 点行直接调 jeCreateJobFromLibrary 入库 (不再有勾选 + 批量按钮 + 弹窗
 *     编辑这种多步流程,因为弹窗也只能改名跟部门,没有真正的编辑价值)
 *   · 添加成功后行立即变 "✓ 已添加" 灰态,用户继续点其他岗位也能添加
 *   · 完整 Success Profile / 8 因子 编辑都在岗位详情页做,这里就是个挑选器
 *
 * 已选状态:jobs 里某条 result.lib_id === entry.id 即视为已添加
 */
import { useMemo, useState } from 'react';
import {
  jeCreateJobFromLibrary,
  type JeLibrary, type JeLibraryEntry, type JeJob,
} from '../api/client';

const BRAND = '#D85A30';
const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';

interface Props {
  library: JeLibrary | null;
  jobs: JeJob[];
  onJobCreated: (job: JeJob) => void;
  defaultOpen?: boolean;
}

export default function LibraryPanel({ library, jobs, onJobCreated, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<Set<string>>(new Set());     // 正在加的 entry id
  const [addError, setAddError] = useState<string | null>(null);

  // 已添加的 lib_id 集合(jobs 里某条 result.lib_id 命中即视为已添加)
  const usedLibIds = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      const lid = (j.result as any)?.lib_id;
      if (lid) set.add(lid);
    }
    return set;
  }, [jobs]);

  if (!library || !library.entries || library.entries.length === 0) {
    return (
      <div style={emptyStyle}>
        AI 推荐岗位库还没生成 — 完成路径 C 访谈后,这里会出现你们行业的标准岗位清单。
      </div>
    );
  }

  // 搜索:跨 name / department / function / sub_function 做 fuzzy 匹配
  const q = query.trim().toLowerCase();
  const filtered = q
    ? library.entries.filter(e => {
        const fields = [
          e.name, e.department || '', e.function,
          (e as any).sub_function || '',
        ];
        return fields.some(f => f && f.toLowerCase().includes(q));
      })
    : library.entries;

  // 按部门分组
  const grouped: Record<string, JeLibraryEntry[]> = {};
  for (const e of filtered) {
    const dept = e.department || '未分组';
    (grouped[dept] ||= []).push(e);
  }

  const handleAdd = async (entry: JeLibraryEntry) => {
    if (usedLibIds.has(entry.id) || adding.has(entry.id)) return;
    setAdding(prev => new Set(prev).add(entry.id));
    setAddError(null);
    try {
      const res = await jeCreateJobFromLibrary({ lib_id: entry.id });
      onJobCreated(res.data.job);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '未知错误';
      setAddError(`「${entry.name}」添加失败: ${msg}`);
      console.warn('[library] add failed', e);
    } finally {
      setAdding(prev => {
        const next = new Set(prev);
        next.delete(entry.id);
        return next;
      });
    }
  };

  return (
    <div style={containerStyle}>
      <div onClick={() => setOpen(o => !o)} style={headerStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
            标准岗位库 <span style={{ marginLeft: 6, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>
              {library.entries.length} 个 · 已添加 {usedLibIds.size}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            点你公司有的岗位直接添加 — 添加后在岗位详情页可以看完整 Success Profile + 调整 8 因子
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{open ? '收起 ▲' : '展开 ▼'}</span>
      </div>

      {open && (
        <>
          {/* 搜索框 */}
          <div style={{ padding: '0 16px 10px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜岗位 — 比如 '市场经理' / 'HR' / '财务'"
                style={{
                  width: '100%', padding: '8px 32px 8px 12px',
                  fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 6,
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    border: 'none', background: 'transparent', color: '#94A3B8',
                    cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
                  }}
                  title="清除"
                >×</button>
              )}
            </div>
            {q && (
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                {filtered.length === 0
                  ? `没找到匹配"${query}"的岗位 — 试试更短的关键词,或者告诉 Sparky 帮你建一个`
                  : `匹配 ${filtered.length} 个岗位`}
              </div>
            )}
          </div>

          {addError && (
            <div style={{
              margin: '8px 16px', padding: '8px 12px',
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6,
              fontSize: 12, color: '#B91C1C',
            }}>
              {addError}
            </div>
          )}

          <div style={contentStyle}>
            {Object.entries(grouped).map(([dept, items]) => (
              <DeptGroup
                key={dept}
                dept={dept}
                items={items}
                usedLibIds={usedLibIds}
                addingIds={adding}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// 部门分组 + entry 行
// ============================================================================
function DeptGroup({ dept, items, usedLibIds, addingIds, onAdd }: {
  dept: string;
  items: JeLibraryEntry[];
  usedLibIds: Set<string>;
  addingIds: Set<string>;
  onAdd: (entry: JeLibraryEntry) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // 按 hay_grade 降序排(高级岗位排前面)
  const sorted = [...items].sort((a, b) => (b.hay_grade ?? 0) - (a.hay_grade ?? 0));
  return (
    <div style={{ marginBottom: 14 }}>
      <div onClick={() => setCollapsed(c => !c)} style={{
        fontSize: 11, color: '#64748B', fontWeight: 500,
        marginBottom: 6, cursor: 'pointer', userSelect: 'none',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>{collapsed ? '▶' : '▼'} {dept} · {items.length}</span>
      </div>
      {!collapsed && sorted.map(e => (
        <EntryRow
          key={e.id}
          entry={e}
          used={usedLibIds.has(e.id)}
          adding={addingIds.has(e.id)}
          onClick={() => onAdd(e)}
        />
      ))}
    </div>
  );
}

function EntryRow({ entry, used, adding, onClick }: {
  entry: JeLibraryEntry;
  used: boolean;
  adding: boolean;
  onClick: () => void;
}) {
  const dom = pickDominant(entry);
  const disabled = used || adding;
  const purpose = entry.success_profile?.purpose
    || entry.responsibilities[0]
    || '';

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6,
        cursor: disabled ? 'default' : 'pointer',
        opacity: used ? 0.5 : 1,
        marginBottom: 2,
        transition: 'background 0.12s',
      }}
      onMouseOver={e => { if (!disabled) e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseOut={e => { if (!disabled) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ width: 4, height: 16, borderRadius: 2, background: dom.color, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, color: '#0F172A', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{entry.name}</span>
          {entry.profile && (
            <span style={{ fontSize: 10, color: '#94A3B8' }} title="Hay Short Profile">
              {entry.profile}
            </span>
          )}
          {used && <span style={{ fontSize: 10, color: '#16A34A' }}>✓ 已添加</span>}
          {adding && <span style={{ fontSize: 10, color: '#94A3B8' }}>添加中…</span>}
          {entry.invalid_factors && (
            <span title="LLM 给的因子组合不合法,分数仅供参考"
                  style={{ fontSize: 10, color: '#D97706' }}>⚠ 因子异常</span>
          )}
        </div>
        {purpose && (
          <div style={{
            fontSize: 10, color: '#94A3B8', marginTop: 2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {entry.function} · {purpose}
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: BRAND, minWidth: 28, textAlign: 'right' }}>
        {entry.hay_grade != null ? `G${entry.hay_grade}` : '—'}
      </div>
    </div>
  );
}

// ============================================================================
// 工具
// ============================================================================
function pickDominant(e: JeLibraryEntry): { color: string; label: string } {
  // standard library entry 没分数,用 track 标记替代主导维度色
  if (e.kh_score == null || e.ps_score == null || e.acc_score == null) {
    if (e.track === 'management') return { color: ACC_COLOR, label: '管理通道' };
    if (e.track === 'specialist') return { color: KH_COLOR, label: '专业通道' };
    return { color: '#94A3B8', label: '—' };
  }
  const kh = e.kh_score, ps = e.ps_score, acc = e.acc_score;
  const total = kh + ps + acc;
  if (total === 0) return { color: '#94A3B8', label: '—' };
  const m = Math.max(kh, ps, acc);
  if (m === kh) return { color: KH_COLOR, label: 'KH' };
  if (m === ps) return { color: PS_COLOR, label: 'PS' };
  return { color: ACC_COLOR, label: 'ACC' };
}

// ============================================================================
// 样式
// ============================================================================
const containerStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
  marginBottom: 16, overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '14px 16px', display: 'flex',
  justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', borderBottom: '1px solid #F1F5F9',
};

const contentStyle: React.CSSProperties = {
  padding: 16, maxHeight: 480, overflowY: 'auto',
};

const emptyStyle: React.CSSProperties = {
  padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center',
  background: '#F8FAFC', borderRadius: 8, marginBottom: 16,
};
