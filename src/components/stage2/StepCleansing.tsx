import { useState, useCallback } from 'react';
import { revertCleansing, getExportUrl } from '../../api/client';
import type { ParseResult } from '../../types';

interface StepCleansingProps {
  parseResult?: ParseResult | null;
  setParseResult: React.Dispatch<React.SetStateAction<ParseResult | null>>;
  sessionId: string | null;
  onNext: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  annualize_bonus: '年终奖年化',
  reclassify_13th: '13薪重分类',
  standardize_performance: '绩效标准化',
  merge_department: '部门归并',
  merge_city: '城市归并',
  extreme_value_salary: '月薪异常',
  extreme_value_bonus: '年终奖异常',
  extreme_value: '异常值',
  salary_inversion: '薪酬倒挂',
  date_anomaly: '日期异常',
  duplicate_13th_check: '13薪交叉校验',
  extreme_dispersion: '极端离散',
  extreme_value_allowance: '津贴异常',
};

/** 按 type 分组 */
function groupByType(items: any[]): { type: string; label: string; items: any[] }[] {
  const map: Record<string, any[]> = {};
  const order: string[] = [];
  for (const c of items) {
    const t = c.type || 'unknown';
    if (!map[t]) { map[t] = []; order.push(t); }
    map[t].push(c);
  }
  return order.map(t => ({ type: t, label: TYPE_LABELS[t] || t, items: map[t] }));
}

export default function StepCleansing({ parseResult, setParseResult, sessionId, onNext }: StepCleansingProps) {
  const allCorrections = parseResult?.cleansing_corrections ?? [];
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 排除完整性检查中已处理的缺失记录行
  const missingRows = new Set(
    (parseResult?.completeness_issues?.row_missing ?? []).map(r => r.row)
  );
  const corrections = allCorrections.filter(c => {
    const row = (c as any).row_number;
    return !row || !missingRows.has(row);
  });

  const autoFixed = corrections.filter(c => (c as any).confidence !== 'low');
  const needsConfirm = corrections.filter(c => (c as any).confidence === 'low');

  const autoGroups = groupByType(autoFixed);
  const confirmGroups = groupByType(needsConfirm);

  const handleAction = useCallback(async (mutationId: number) => {
    if (!sessionId) return;
    try {
      const res = await revertCleansing(sessionId, mutationId);
      setParseResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cleansing_corrections: prev.cleansing_corrections.map(c =>
            c.id === mutationId ? { ...c, reverted: res.data.reverted } : c
          ),
        };
      });
    } catch (err) {
      console.warn('Action failed:', err);
    }
  }, [sessionId, setParseResult]);

  // 批量操作同 type 的所有 mutation
  const handleGroupAction = useCallback(async (items: any[], action: 'confirm' | 'ignore') => {
    if (!sessionId) return;
    for (const c of items) {
      const shouldRevert = action === 'ignore' && !c.reverted;
      const shouldReapply = action === 'confirm' && c.reverted;
      if (shouldRevert || shouldReapply) {
        try {
          const res = await revertCleansing(sessionId, c.id);
          setParseResult(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              cleansing_corrections: prev.cleansing_corrections.map(cc =>
                cc.id === c.id ? { ...cc, reverted: res.data.reverted } : cc
              ),
            };
          });
        } catch {}
      }
    }
  }, [sessionId, setParseResult]);

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleItem = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const renderAutoGroup = (group: { type: string; label: string; items: any[] }) => {
    const isOpen = expandedGroups.has('auto_' + group.type);
    const allReverted = group.items.every(c => c.reverted);

    return (
      <div key={group.type} style={{
        marginBottom: 8, background: '#fff', border: '1px solid #d1fae5',
        borderRadius: 8, overflow: 'hidden', opacity: allReverted ? 0.6 : 1,
      }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}
          onClick={() => toggleGroup('auto_' + group.type)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#D1FAE5', color: '#065F46', flexShrink: 0 }}>{group.label}</span>
            <span style={{ fontSize: 13, color: allReverted ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: allReverted ? 'line-through' : 'none' }}>
              {group.items.length === 1 ? group.items[0].description : `${group.items.length} 条修正`}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleAction(group.items[0].id); }}
            style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 12 }}
          >
            {allReverted ? '恢复' : '撤回'}
          </button>
        </div>
        {isOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 12px 38px' }}>
            {group.items.map(c => (
              <div key={c.id} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ textDecoration: c.reverted ? 'line-through' : 'none' }}>{c.description}</span>
                {c.old_value != null && c.new_value != null && (
                  <span style={{ fontFamily: 'monospace', marginLeft: 12, flexShrink: 0 }}>{c.old_value} → {c.new_value}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderConfirmGroup = (group: { type: string; label: string; items: any[] }) => {
    const isOpen = expandedGroups.has('confirm_' + group.type);
    const is13thCheck = group.type === 'duplicate_13th_check';

    return (
      <div key={group.type} style={{
        marginBottom: 8, background: '#fff', border: '1px solid #fde68a',
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer' }}
          onClick={() => toggleGroup('confirm_' + group.type)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FEF3C7', color: '#92400E', flexShrink: 0 }}>{group.label}</span>
            <span style={{ fontSize: 13 }}>
              {group.items.length === 1 ? group.items[0].description : `${group.items.length} 条待确认`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleGroupAction(group.items, 'confirm'); }}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid #d1fae5', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {is13thCheck ? '是，已包含' : '确认'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleGroupAction(group.items, 'ignore'); }}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {is13thCheck ? '否，未包含' : '忽略'}
            </button>
          </div>
        </div>
        {isOpen && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 12px 38px' }}>
            {group.items.map(c => (
              <div key={c.id} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 0' }}>
                <span style={{ textDecoration: c.reverted ? 'line-through' : 'none', opacity: c.reverted ? 0.5 : 1 }}>
                  {c.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const hasExport = corrections.length > 0;
  const noIssues = autoFixed.length === 0 && needsConfirm.length === 0;

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>数据清洗</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        以下修正已应用到数据副本，原始数据不受影响
      </div>

      {noIssues && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          数据质量很好，不需要修正
        </div>
      )}

      {autoGroups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>已自动修正</span>
            <span style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', padding: '2px 10px', borderRadius: 10 }}>
              {autoFixed.length} 项
            </span>
          </div>
          {autoGroups.map(renderAutoGroup)}
        </div>
      )}

      {confirmGroups.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>需要确认</span>
            <span style={{ fontSize: 12, color: '#92400E', background: '#FEF3C7', padding: '2px 10px', borderRadius: 10 }}>
              {needsConfirm.length} 项
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            以下问题无法自动判断，请人工确认后决定是否保留
          </div>
          {confirmGroups.map(renderConfirmGroup)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {hasExport && sessionId && (
          <a href={getExportUrl(sessionId)} download style={{
            flex: 'none', padding: '10px 20px', borderRadius: 8,
            border: '1px solid var(--border)', background: '#fff',
            color: 'var(--text-secondary)', fontSize: 13,
            textDecoration: 'none', cursor: 'pointer',
          }}>
            下载标注 Excel
          </a>
        )}
        <button className="next-step-btn" onClick={onNext} style={{ flex: 1 }}>下一步 →</button>
      </div>
    </div>
  );
}
