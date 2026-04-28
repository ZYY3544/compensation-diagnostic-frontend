/**
 * 标准岗位库面板 — 用户从这里挑岗位添加到自己的图谱里。
 *
 * 数据源:JeProfile.library_data (来自 standard_libraries/<行业>.json)。
 *
 * 交互模型 (V2 — 多职级变体):
 *   · 搜索框 fuzzy 匹配 name/department/function/sub_function
 *   · 按部门分组,每行展示一个 role family (e.g. "HR 经理")
 *   · 行右侧并列多个职级 chip 按钮 (G15 / G16 / G17),用户点哪个加哪个
 *   · 同一个 role family 的多个 chip 共用一份 Success Profile (在详情页能看)
 *   · 点 chip → jeCreateJobFromLibrary(lib_id, target_grade) 入库
 *   · chip 立即变 "✓ G16" 灰态,继续可点其他 grade chip 添加同一岗位的不同档
 *
 * 已添加判定:job.result.lib_id === entry.id 且 job.result.lib_grade === variant.hay_grade
 */
import { useMemo, useState } from 'react';
import {
  jeCreateJobFromLibrary,
  type JeLibrary, type JeLibraryEntry, type JeJob, type JeGradeVariant,
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
  const [adding, setAdding] = useState<Set<string>>(new Set());     // (lib_id_grade) 复合键
  const [addError, setAddError] = useState<string | null>(null);

  // 已添加 (lib_id, grade) 复合键集合 — 同 role family 不同 grade 算独立 entry
  const usedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      const r = (j.result as any) || {};
      const lid = r.lib_id;
      const grade = r.lib_grade ?? r.hay_grade ?? r.job_grade;
      if (lid && grade != null) set.add(`${lid}_g${grade}`);
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

  const handleAdd = async (entry: JeLibraryEntry, variant: JeGradeVariant) => {
    const key = `${entry.id}_g${variant.hay_grade}`;
    if (usedKeys.has(key) || adding.has(key)) return;
    setAdding(prev => new Set(prev).add(key));
    setAddError(null);
    try {
      const res = await jeCreateJobFromLibrary({
        lib_id: entry.id,
        target_grade: variant.hay_grade,
      });
      onJobCreated(res.data.job);
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || '未知错误';
      setAddError(`「${entry.name} G${variant.hay_grade}」添加失败: ${msg}`);
      console.warn('[library] add failed', e);
    } finally {
      setAdding(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // 统计已添加的 variant 数量(用于 header 显示)
  const totalVariants = library.entries.reduce((s, e) => s + (e.grade_variants?.length || 0), 0);
  const addedVariants = usedKeys.size;

  return (
    <div style={containerStyle}>
      <div onClick={() => setOpen(o => !o)} style={headerStyle}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>
            标准岗位库 <span style={{ marginLeft: 6, fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>
              {library.entries.length} 个角色 · {totalVariants} 个职级变体 · 已添加 {addedVariants}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            点行右侧职级按钮把对应档位的岗位入库 — 同一岗位多个职级共用一份 Success Profile,详情在岗位详情页查看
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
                  ? `没找到匹配"${query}"的岗位 — 试试更短的关键词`
                  : `匹配 ${filtered.length} 个角色`}
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
                usedKeys={usedKeys}
                addingKeys={adding}
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
// 部门分组 + role family 行
// ============================================================================
function DeptGroup({ dept, items, usedKeys, addingKeys, onAdd }: {
  dept: string;
  items: JeLibraryEntry[];
  usedKeys: Set<string>;
  addingKeys: Set<string>;
  onAdd: (entry: JeLibraryEntry, variant: JeGradeVariant) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  // 按 role family 第一个 variant 的职级降序(高级岗位排前)
  const sorted = [...items].sort((a, b) => {
    const ag = a.grade_variants?.[0]?.hay_grade ?? 0;
    const bg = b.grade_variants?.[0]?.hay_grade ?? 0;
    return bg - ag;
  });
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
          usedKeys={usedKeys}
          addingKeys={addingKeys}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

function EntryRow({ entry, usedKeys, addingKeys, onAdd }: {
  entry: JeLibraryEntry;
  usedKeys: Set<string>;
  addingKeys: Set<string>;
  onAdd: (entry: JeLibraryEntry, variant: JeGradeVariant) => void;
}) {
  const variants = entry.grade_variants || [];
  // 用中位 variant 的 KH/PS/ACC 推主导维度色
  const midVariant = variants[Math.floor(variants.length / 2)] || variants[0];
  const dom = pickDominant(midVariant);
  const purpose = entry.success_profile?.purpose
    || entry.responsibilities?.[0]
    || '';

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 10px', borderRadius: 6,
        marginBottom: 2,
        transition: 'background 0.12s',
      }}
      onMouseOver={e => { e.currentTarget.style.background = '#F8FAFC'; }}
      onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ width: 4, height: 16, borderRadius: 2, background: dom.color, flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12, color: '#0F172A', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{entry.name}</span>
          {midVariant?.profile && (
            <span style={{ fontSize: 10, color: '#94A3B8' }} title="Hay Short Profile">
              {midVariant.profile}
            </span>
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
      {/* 职级变体按钮:每个 grade 一个 chip,点哪个加哪个 */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {variants.map(v => {
          const key = `${entry.id}_g${v.hay_grade}`;
          const used = usedKeys.has(key);
          const adding = addingKeys.has(key);
          const disabled = used || adding;
          return (
            <button
              key={v.hay_grade}
              onClick={() => onAdd(entry, v)}
              disabled={disabled}
              title={used ? '已添加 — 进图谱看' : `添加 G${v.hay_grade} 的 ${entry.name} 入库`}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: 600,
                border: used ? 'none' : `1px solid ${BRAND}`,
                borderRadius: 4,
                background: used ? '#F1F5F9' : (adding ? '#FEF7F4' : '#fff'),
                color: used ? '#16A34A' : (adding ? '#94A3B8' : BRAND),
                cursor: disabled ? 'default' : 'pointer',
                minWidth: 44, textAlign: 'center',
              }}
            >
              {used ? `✓ G${v.hay_grade}` : (adding ? '…' : `G${v.hay_grade}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 工具
// ============================================================================
function pickDominant(v: JeGradeVariant | undefined): { color: string; label: string } {
  if (!v) return { color: '#94A3B8', label: '—' };
  const total = v.kh_score + v.ps_score + v.acc_score;
  if (total === 0) return { color: '#94A3B8', label: '—' };
  const m = Math.max(v.kh_score, v.ps_score, v.acc_score);
  if (m === v.kh_score) return { color: KH_COLOR, label: 'KH' };
  if (m === v.ps_score) return { color: PS_COLOR, label: 'PS' };
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
