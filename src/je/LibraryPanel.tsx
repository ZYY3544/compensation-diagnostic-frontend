/**
 * AI 推荐岗位库面板（matrix 视图右侧 Workspace 顶部叠加，可折叠）。
 *
 * 来源：Step 0 访谈完成后 LLM 生成的 20-40 个推荐岗位（写入 JeProfile.library_data）。
 * 进入面板时通过 jeGetLibrary 拉取，已经被添加到 jobs 表的 entry 标记为"已选"。
 *
 * 设计要点（v2 文档第 4.2 节）：
 *  - 面板叠加在图谱矩阵上方，不替换 — 用户勾选后，岗位实时出现在下方矩阵
 *  - 默认折叠（保持图谱主体可见），首次进入或用户主动展开时打开
 *  - 按部门分组，每组列出 entry（岗位名 + 建议职级 + 主导维度色条）
 *  - 复选框勾选 → 点"添加 N 个岗位" → 弹 AddFromLibraryModal 让用户最后确认/改名
 *
 * 已选状态判断：jobs 列表里有 result.lib_id === entry.id 的岗位即视为"已选"
 *  → checkbox 灰色不可勾选 + 标"已添加"
 */
import { useMemo, useState } from 'react';
import {
  jeCreateJobFromLibrary,
  type JeLibrary, type JeLibraryEntry, type JeJob,
} from '../api/client';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';
const KH_COLOR = '#4F46E5';
const PS_COLOR = '#0EA5E9';
const ACC_COLOR = '#F59E0B';

interface Props {
  library: JeLibrary | null;
  jobs: JeJob[];
  onJobCreated: (job: JeJob) => void;
  onRegenerate?: () => void;       // 后续支持"重新生成"，本期可不传
  defaultOpen?: boolean;
}

export default function LibraryPanel({ library, jobs, onJobCreated, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingEntry, setEditingEntry] = useState<JeLibraryEntry | null>(null);
  const [query, setQuery] = useState('');     // 搜索关键词

  // 已选 lib_id 集合（jobs 里某条 result.lib_id 命中即视为已添加）
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
        AI 岗位库还没生成 — 完成 Step 0 访谈后 Sparky 会自动生成 20-40 个推荐岗位。
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

  // 按部门分组（无部门归到"未分组"）
  const grouped: Record<string, JeLibraryEntry[]> = {};
  for (const e of filtered) {
    const dept = e.department || '未分组';
    (grouped[dept] ||= []).push(e);
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedEntries = library.entries.filter(e => selected.has(e.id));
  const handleBatchAdd = () => {
    if (selectedEntries.length === 0) return;
    // 如果只选了一个，直接弹编辑面板让用户确认改名
    // 选多个时也弹同一个面板，让用户逐个确认（或直接批量添加默认值）
    if (selectedEntries.length === 1) {
      setEditingEntry(selectedEntries[0]);
      return;
    }
    // 多选直接批量添加（用 entry 默认 name/department，用户后续在岗位详情页可改）
    batchAdd(selectedEntries).catch(e => alert(`部分添加失败：${e?.message || e}`));
  };

  const batchAdd = async (entries: JeLibraryEntry[]) => {
    for (const e of entries) {
      try {
        const res = await jeCreateJobFromLibrary({ lib_id: e.id });
        onJobCreated(res.data.job);
      } catch (err: any) {
        console.warn(`[library] 添加 ${e.name} 失败`, err);
      }
    }
    setSelected(new Set());
  };

  return (
    <div style={containerStyle}>
      <div onClick={() => setOpen(o => !o)} style={headerStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
            AI 推荐岗位库 <span style={{ marginLeft: 6, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>
              {library.entries.length} 个 · 已添加 {usedLibIds.size}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            根据你们组织画像生成的标准岗位 — 勾选跟实际匹配的，添加到我的岗位
          </div>
        </div>
        <span style={{ fontSize: 12, color: '#64748B' }}>{open ? '收起 ▲' : '展开 ▼'}</span>
      </div>

      {open && (
        <>
          {/* 搜索框 — 跨全库 fuzzy 匹配 name/department/function/sub_function */}
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

          <div style={contentStyle}>
            {Object.entries(grouped).map(([dept, items]) => (
              <DeptGroup
                key={dept}
                dept={dept}
                items={items}
                usedLibIds={usedLibIds}
                selected={selected}
                onToggle={toggle}
              />
            ))}
          </div>

          {selected.size > 0 && (
            <div style={footerStyle}>
              <span style={{ fontSize: 12, color: '#475569' }}>已选 {selected.size} 个</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setSelected(new Set())} style={ghostBtn}>清空</button>
                <button onClick={handleBatchAdd} style={primaryBtn}>
                  {selected.size === 1 ? '添加并编辑' : `添加 ${selected.size} 个岗位`}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 单条编辑 modal */}
      {editingEntry && (
        <AddFromLibraryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onConfirm={async (params) => {
            try {
              const res = await jeCreateJobFromLibrary(params);
              onJobCreated(res.data.job);
              setEditingEntry(null);
              setSelected(new Set());
            } catch (e: any) {
              alert(`添加失败：${e?.response?.data?.error || e.message}`);
            }
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 部门分组 + entry 行
// ============================================================================
function DeptGroup({ dept, items, usedLibIds, selected, onToggle }: {
  dept: string;
  items: JeLibraryEntry[];
  usedLibIds: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // 按 hay_grade 降序排（高级岗位排前面）
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
          selected={selected.has(e.id)}
          onToggle={() => onToggle(e.id)}
        />
      ))}
    </div>
  );
}

function EntryRow({ entry, used, selected, onToggle }: {
  entry: JeLibraryEntry;
  used: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const dom = pickDominant(entry);
  return (
    <div
      onClick={used ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 10px', borderRadius: 6,
        cursor: used ? 'default' : 'pointer',
        background: selected ? BRAND_TINT : 'transparent',
        opacity: used ? 0.5 : 1,
        marginBottom: 2,
      }}
      onMouseOver={e => { if (!used && !selected) e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseOut={e => { if (!used && !selected) e.currentTarget.style.background = 'transparent'; }}
    >
      <input
        type="checkbox"
        checked={used || selected}
        disabled={used}
        readOnly
        style={{ cursor: used ? 'not-allowed' : 'pointer' }}
      />
      <div style={{ flex: 1, fontSize: 12, color: '#0F172A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 4, height: 14, borderRadius: 2, background: dom.color }} />
          <span>{entry.name}</span>
          {used && <span style={{ fontSize: 10, color: '#94A3B8' }}>已添加</span>}
          {entry.invalid_factors && (
            <span title="LLM 给的因子组合不合法，分数仅供参考"
                  style={{ fontSize: 10, color: '#D97706' }}>⚠ 因子异常</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
          {entry.function} · {dom.label} 主导
          {entry.responsibilities.length > 0 && ` · ${entry.responsibilities[0]}`}
        </div>
      </div>
      <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: BRAND }}>
        {entry.hay_grade != null ? `G${entry.hay_grade}` : '—'}
      </div>
    </div>
  );
}

// ============================================================================
// 单条编辑 modal（用户可改名 + 确认部门归属再建岗）
// ============================================================================
function AddFromLibraryModal({ entry, onClose, onConfirm }: {
  entry: JeLibraryEntry;
  onClose: () => void;
  onConfirm: (params: { lib_id: string; title?: string; department?: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState(entry.name);
  const [department, setDepartment] = useState(entry.department || '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onConfirm({
      lib_id: entry.id,
      title: title.trim() || undefined,
      department: department.trim() || undefined,
    });
    // 不 setSaving(false)，因为 onConfirm 成功会卸载 modal
  };

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
          添加岗位
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16, lineHeight: 1.6 }}>
          基于 AI 推荐的「{entry.name}」（{entry.function} · G{entry.hay_grade}）。
          可以改成你们公司实际的岗位名称，或者留空用默认值。
        </div>

        <FormRow label="岗位名称">
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle} />
        </FormRow>
        <FormRow label="部门">
          <input value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle} />
        </FormRow>

        {entry.factors ? (
          <div style={{ marginTop: 12, padding: 10, background: '#F8FAFC', borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>该岗位将带以下因子(后续可在详情页调整):</div>
            <div style={{ fontSize: 11, color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
              <span>PK <strong>{entry.factors.practical_knowledge}</strong></span>
              <span>MK <strong>{entry.factors.managerial_knowledge}</strong></span>
              <span>Comm <strong>{entry.factors.communication}</strong></span>
              <span>TC <strong>{entry.factors.thinking_challenge}</strong></span>
              <span>TE <strong>{entry.factors.thinking_environment}</strong></span>
              <span>FTA <strong>{entry.factors.freedom_to_act}</strong></span>
              <span>Mag <strong>{entry.factors.magnitude}</strong></span>
              <span>NoI <strong>{entry.factors.nature_of_impact}</strong></span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12, padding: 10, background: '#FEF7F4', borderRadius: 6, fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
            添加时会按 Hay 职级 G{entry.hay_grade} 自动生成一组合理的 8 因子档位,后续可以在岗位详情页手改任何档位 — 分数和职级会跟着重新计算。
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={ghostBtn}>取消</button>
          <button onClick={submit} disabled={saving} style={primaryBtn}>
            {saving ? '添加中…' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#64748B', marginBottom: 6 }}>
        {label}
      </label>
      {children}
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
  marginBottom: 12,
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '12px 16px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  cursor: 'pointer', userSelect: 'none',
  borderBottom: '1px solid #F1F5F9',
};

const contentStyle: React.CSSProperties = {
  padding: '12px 16px',
  maxHeight: 380, overflowY: 'auto',
};

const footerStyle: React.CSSProperties = {
  padding: '10px 16px', borderTop: '1px solid #F1F5F9',
  background: '#FAFBFC',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

const emptyStyle: React.CSSProperties = {
  padding: 24, textAlign: 'center',
  fontSize: 12, color: '#94A3B8',
  background: '#fff', border: '1px dashed #E2E8F0', borderRadius: 12,
  marginBottom: 12,
};

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 6,
  border: 'none', background: BRAND, color: '#fff',
  fontSize: 12, cursor: 'pointer', fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 6,
  border: '1px solid #E2E8F0', background: '#fff', color: '#475569',
  fontSize: 12, cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid #E2E8F0', borderRadius: 6, outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

const modalBox: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 24,
  width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
  boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
};
