/**
 * 标准岗位库面板 — 用户从这里挑岗位添加到自己的图谱里。
 *
 * 数据源:JeProfile.library_data (来自 standard_libraries/<行业>.json)。
 *
 * 交互模型 (V3 — 多选下拉):
 *   · 搜索框 fuzzy 匹配 name/department/function/sub_function
 *   · 按部门分组,每行展示一个 role family (e.g. "HR 经理")
 *   · 点 role family 行展开,出来 N 行职级变体 (G15 / G16 / G17 各一行)
 *   · 每行变体前面有 checkbox,可勾选多个
 *   · 选中后底部出现"添加岗位"按钮,点击批量入库
 *   · 已添加的变体显示 ✓ 已添加 灰态,checkbox 不可勾
 *   · 共享 Success Profile 在岗位详情页的 "Success Profile" 抽屉里看
 *
 * 已添加判定:job.result.lib_id === entry.id 且 job.result.lib_grade === variant.hay_grade
 */
import { useMemo, useState } from 'react';
import {
  jeCreateJobFromLibrary,
  type JeLibrary, type JeLibraryEntry, type JeJob, type JeGradeVariant,
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
  defaultOpen?: boolean;
}

const variantKey = (libId: string, grade: number) => `${libId}_g${grade}`;

export default function LibraryPanel({ library, jobs, onJobCreated, defaultOpen = true }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // 已添加 (lib_id, grade) 复合键集合 — 同 role family 不同 grade 算独立 entry
  const usedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const j of jobs) {
      const r = (j.result as any) || {};
      const lid = r.lib_id;
      const grade = r.lib_grade ?? r.hay_grade ?? r.job_grade;
      if (lid && grade != null) set.add(variantKey(lid, grade));
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

  const toggleFamily = (id: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelected = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (selectedKeys.size === 0) return;
    setAdding(true);
    setAddError(null);
    const tasks: Array<Promise<{ data: { job: JeJob } }>> = [];
    for (const key of selectedKeys) {
      const m = key.match(/^(.+)_g(\d+)$/);
      if (!m) continue;
      const libId = m[1];
      const grade = parseInt(m[2], 10);
      tasks.push(jeCreateJobFromLibrary({ lib_id: libId, target_grade: grade }));
    }
    const failed: string[] = [];
    try {
      const results = await Promise.allSettled(tasks);
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          onJobCreated(r.value.data.job);
        } else {
          failed.push(r.reason?.message || '未知错误');
        }
      }
      if (failed.length > 0) {
        setAddError(`${failed.length} 个失败: ${failed[0]}`);
      } else {
        setSelectedKeys(new Set());
      }
    } finally {
      setAdding(false);
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
            点角色行展开看职级变体 → 勾选要的职级 → 点底部"添加岗位"批量入库
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
                expandedFamilies={expandedFamilies}
                onToggleFamily={toggleFamily}
                selectedKeys={selectedKeys}
                onToggleSelected={toggleSelected}
                usedKeys={usedKeys}
              />
            ))}
          </div>

          {/* 底部 action bar — 选中时才出现,统一批量入库 */}
          {selectedKeys.size > 0 && (
            <div style={footerStyle}>
              <span style={{ fontSize: 12, color: '#475569' }}>
                已选 {selectedKeys.size} 个职级变体
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setSelectedKeys(new Set())}
                  disabled={adding}
                  style={ghostBtn}
                >
                  清空
                </button>
                <button
                  onClick={handleAddSelected}
                  disabled={adding}
                  style={{ ...primaryBtn, opacity: adding ? 0.6 : 1 }}
                >
                  {adding ? '添加中…' : `添加岗位 (${selectedKeys.size})`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// 部门分组
// ============================================================================
function DeptGroup({ dept, items, expandedFamilies, onToggleFamily, selectedKeys, onToggleSelected, usedKeys }: {
  dept: string;
  items: JeLibraryEntry[];
  expandedFamilies: Set<string>;
  onToggleFamily: (id: string) => void;
  selectedKeys: Set<string>;
  onToggleSelected: (key: string) => void;
  usedKeys: Set<string>;
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
        <RoleFamilyRow
          key={e.id}
          entry={e}
          expanded={expandedFamilies.has(e.id)}
          onToggleFamily={() => onToggleFamily(e.id)}
          selectedKeys={selectedKeys}
          onToggleSelected={onToggleSelected}
          usedKeys={usedKeys}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Role family 行 (上层)— 点击展开 N 行 grade variant
// ============================================================================
function RoleFamilyRow({ entry, expanded, onToggleFamily, selectedKeys, onToggleSelected, usedKeys }: {
  entry: JeLibraryEntry;
  expanded: boolean;
  onToggleFamily: () => void;
  selectedKeys: Set<string>;
  onToggleSelected: (key: string) => void;
  usedKeys: Set<string>;
}) {
  const variants = entry.grade_variants || [];
  const midVariant = variants[Math.floor(variants.length / 2)] || variants[0];
  const dom = pickDominant(midVariant);
  const purpose = entry.success_profile?.purpose || '';

  // 该 family 是否所有 variant 都已添加
  const allUsed = variants.length > 0 && variants.every(v => usedKeys.has(variantKey(entry.id, v.hay_grade)));
  // 该 family 已选中的 variant 数量
  const selectedInFamily = variants.filter(v => selectedKeys.has(variantKey(entry.id, v.hay_grade))).length;

  const gradeRange = variants.length > 0
    ? variants.length === 1
      ? `G${variants[0].hay_grade}`
      : `G${Math.min(...variants.map(v => v.hay_grade))}–G${Math.max(...variants.map(v => v.hay_grade))}`
    : '—';

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        onClick={onToggleFamily}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 6,
          cursor: 'pointer',
          background: expanded ? '#F8FAFC' : 'transparent',
          opacity: allUsed ? 0.55 : 1,
          transition: 'background 0.12s',
        }}
        onMouseOver={e => { if (!expanded) e.currentTarget.style.background = '#F8FAFC'; }}
        onMouseOut={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          flexShrink: 0, fontSize: 11, color: '#94A3B8', width: 12, textAlign: 'center',
        }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ width: 4, height: 16, borderRadius: 2, background: dom.color, flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 12, color: '#0F172A', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 500 }}>{entry.name}</span>
            {midVariant?.profile && (
              <span style={{ fontSize: 10, color: '#94A3B8' }} title="Hay Short Profile">
                {midVariant.profile}
              </span>
            )}
            {selectedInFamily > 0 && (
              <span style={{ fontSize: 10, color: BRAND, fontWeight: 600 }}>
                · 已选 {selectedInFamily}
              </span>
            )}
            {allUsed && (
              <span style={{ fontSize: 10, color: '#16A34A' }}>· 全部已添加</span>
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
        <div style={{
          flexShrink: 0, fontSize: 11, color: '#94A3B8',
          minWidth: 60, textAlign: 'right',
        }}>
          {gradeRange} · {variants.length} 档
        </div>
      </div>

      {/* 展开:列出每个 grade variant 一行,前面 checkbox */}
      {expanded && variants.map(v => (
        <GradeVariantRow
          key={v.hay_grade}
          entryId={entry.id}
          variant={v}
          checked={selectedKeys.has(variantKey(entry.id, v.hay_grade))}
          used={usedKeys.has(variantKey(entry.id, v.hay_grade))}
          onToggle={() => onToggleSelected(variantKey(entry.id, v.hay_grade))}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Grade variant 行 (展开后的子行) — 前面 checkbox
// ============================================================================
function GradeVariantRow({ variant, checked, used, onToggle }: {
  entryId: string;
  variant: JeGradeVariant;
  checked: boolean;
  used: boolean;
  onToggle: () => void;
}) {
  const disabled = used;
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 10px 6px 34px',     // 缩进对齐 role family 名字
        borderRadius: 4,
        cursor: disabled ? 'default' : 'pointer',
        background: checked ? BRAND_TINT : 'transparent',
        opacity: used ? 0.55 : 1,
        marginBottom: 1,
      }}
      onMouseOver={e => { if (!disabled && !checked) e.currentTarget.style.background = '#F1F5F9'; }}
      onMouseOut={e => { if (!disabled && !checked) e.currentTarget.style.background = 'transparent'; }}
    >
      <input
        type="checkbox"
        checked={checked || used}
        disabled={disabled}
        readOnly
        style={{ cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
      />
      <span style={{
        fontSize: 12, fontWeight: 600, color: BRAND,
        minWidth: 36, textAlign: 'left',
      }}>
        G{variant.hay_grade}
      </span>
      {variant.level_label && (
        <span style={{ fontSize: 11, color: '#94A3B8' }}>{variant.level_label}</span>
      )}
      <div style={{ flex: 1, fontSize: 11, color: '#64748B', display: 'flex', gap: 10 }}>
        <span>总分 {variant.total_score}</span>
        {variant.profile && <span>· Profile {variant.profile}</span>}
        <span style={{ color: KH_COLOR }}>KH {variant.kh_score}</span>
        <span style={{ color: PS_COLOR }}>PS {variant.ps_score}</span>
        <span style={{ color: ACC_COLOR }}>ACC {variant.acc_score}</span>
      </div>
      {used && <span style={{ fontSize: 10, color: '#16A34A', flexShrink: 0 }}>✓ 已添加</span>}
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

const footerStyle: React.CSSProperties = {
  padding: '12px 16px', borderTop: '1px solid #F1F5F9',
  background: '#FAFBFC',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

const primaryBtn: React.CSSProperties = {
  padding: '6px 14px', fontSize: 12, fontWeight: 500,
  border: 'none', borderRadius: 6,
  background: BRAND, color: '#fff', cursor: 'pointer',
};

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px', fontSize: 12,
  border: '1px solid #E2E8F0', borderRadius: 6,
  background: '#fff', color: '#475569', cursor: 'pointer',
};

const emptyStyle: React.CSSProperties = {
  padding: 16, fontSize: 12, color: '#94A3B8', textAlign: 'center',
  background: '#F8FAFC', borderRadius: 8, marginBottom: 16,
};
