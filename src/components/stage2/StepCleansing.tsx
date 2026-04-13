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
  // 高置信度
  annualize_bonus: '年终奖年化',
  reclassify_13th: '13薪重分类',
  standardize_performance: '绩效标准化',
  merge_department: '部门归并',
  merge_city: '城市归并',
  // 低置信度
  extreme_value_salary: '月薪异常',
  extreme_value_bonus: '年终奖异常',
  extreme_value: '异常值',
  salary_inversion: '薪酬倒挂',
  date_anomaly: '日期异常',
  duplicate_13th_check: '13薪交叉校验',
  extreme_dispersion: '极端离散',
  extreme_value_allowance: '津贴异常',
};

export default function StepCleansing({ parseResult, setParseResult, sessionId, onNext }: StepCleansingProps) {
  const allCorrections = parseResult?.cleansing_corrections ?? [];
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // 排除完整性检查中已处理的缺失记录行
  const missingRows = new Set(
    (parseResult?.completeness_issues?.row_missing ?? []).map(r => r.row)
  );
  const corrections = allCorrections.filter(c => {
    const row = (c as any).row_number;
    return !row || !missingRows.has(row);
  });

  // 按 confidence 分组
  const autoFixed = corrections.filter(c => (c as any).confidence !== 'low');
  const needsConfirm = corrections.filter(c => (c as any).confidence === 'low');

  const handleRevert = useCallback(async (mutationId: number) => {
    if (!sessionId) return;
    try {
      const res = await revertCleansing(sessionId, mutationId);
      const newReverted = res.data.reverted;
      setParseResult(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          cleansing_corrections: prev.cleansing_corrections.map(c =>
            c.id === mutationId ? { ...c, reverted: newReverted } : c
          ),
        };
      });
    } catch (err) {
      console.warn('Revert failed:', err);
    }
  }, [sessionId, setParseResult]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderItem = (c: any) => {
    const isReverted = c.reverted;
    const isLow = c.confidence === 'low';
    const isExpanded = expandedIds.has(c.id);
    const typeLabel = TYPE_LABELS[c.type] || c.type;
    const hasDetail = c.old_value != null || c.new_value != null;

    return (
      <div
        key={c.id}
        style={{
          marginBottom: 8,
          background: isReverted ? '#f9fafb' : '#fff',
          border: `1px solid ${isReverted ? '#e5e7eb' : isLow ? '#fde68a' : '#d1fae5'}`,
          borderRadius: 8,
          opacity: isReverted ? 0.6 : 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            cursor: hasDetail ? 'pointer' : 'default',
          }}
          onClick={() => hasDetail && toggleExpand(c.id)}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasDetail && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                ▶
              </span>
            )}
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 10,
              background: isLow ? '#FEF3C7' : '#D1FAE5',
              color: isLow ? '#92400E' : '#065F46',
              flexShrink: 0,
            }}>
              {typeLabel}
            </span>
            <span style={{
              fontSize: 13,
              color: isReverted ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: isReverted ? 'line-through' : 'none',
            }}>
              {c.description}
            </span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleRevert(c.id); }}
            style={{
              fontSize: 12, padding: '4px 12px', borderRadius: 6,
              border: '1px solid var(--border)', background: '#fff',
              color: 'var(--text-secondary)', cursor: 'pointer',
              whiteSpace: 'nowrap', marginLeft: 12, flexShrink: 0,
            }}
          >
            {isReverted ? '恢复' : '撤回'}
          </button>
        </div>

        {/* 展开详情 */}
        {isExpanded && hasDetail && (
          <div style={{
            padding: '0 16px 12px 38px',
            fontSize: 12, color: 'var(--text-muted)',
            borderTop: '1px solid var(--border)',
            paddingTop: 10,
          }}>
            {c.old_value != null && (
              <div>原始值：<span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{String(c.old_value)}</span></div>
            )}
            {c.new_value != null && (
              <div>修正为：<span style={{ color: 'var(--blue)', fontWeight: 600, fontFamily: 'monospace' }}>{String(c.new_value)}</span></div>
            )}
            {c.old_value != null && c.new_value != null && (
              <div style={{ marginTop: 4, color: '#6b7280' }}>
                {c.old_value} → {c.new_value}
              </div>
            )}
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

      {/* 已自动修正 */}
      {autoFixed.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>已自动修正</span>
            <span style={{ fontSize: 12, color: '#065F46', background: '#D1FAE5', padding: '2px 10px', borderRadius: 10 }}>
              {autoFixed.length} 项
            </span>
          </div>
          {autoFixed.map(renderItem)}
        </div>
      )}

      {/* 需要确认 */}
      {needsConfirm.length > 0 && (
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
          {needsConfirm.map(renderItem)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {hasExport && sessionId && (
          <a
            href={getExportUrl(sessionId)}
            download
            style={{
              flex: 'none', padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', background: '#fff',
              color: 'var(--text-secondary)', fontSize: 13,
              textDecoration: 'none', cursor: 'pointer',
            }}
          >
            下载标注 Excel
          </a>
        )}
        <button className="next-step-btn" onClick={onNext} style={{ flex: 1 }}>下一步 →</button>
      </div>
    </div>
  );
}
