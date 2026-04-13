import { useCallback } from 'react';
import { revertCleansing, getExportUrl } from '../../api/client';
import type { ParseResult } from '../../types';

interface StepCleansingProps {
  parseResult?: ParseResult | null;
  setParseResult: React.Dispatch<React.SetStateAction<ParseResult | null>>;
  sessionId: string | null;
  onNext: () => void;
}

export default function StepCleansing({ parseResult, setParseResult, sessionId, onNext }: StepCleansingProps) {
  const corrections = parseResult?.cleansing_corrections ?? [];

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

  const hasExport = corrections.length > 0;

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>数据清洗</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        以下修正已应用到数据副本，原始数据不受影响
      </div>

      {corrections.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          数据质量很好，不需要修正
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {corrections.map(c => {
            const isReverted = (c as any).reverted;
            const confidence = (c as any).confidence || 'high';
            const oldVal = (c as any).old_value;
            const newVal = (c as any).new_value;
            const isLow = confidence === 'low';

            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  padding: '14px 18px',
                  marginBottom: 8,
                  background: isReverted ? '#f9fafb' : '#fff',
                  border: `1px solid ${isReverted ? '#e5e7eb' : isLow ? '#fde68a' : '#d1fae5'}`,
                  borderRadius: 8,
                  opacity: isReverted ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: isLow ? '#FEF3C7' : '#D1FAE5',
                      color: isLow ? '#92400E' : '#065F46',
                    }}>
                      {isLow ? '需确认' : '已修正'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.type}</span>
                  </div>
                  <div style={{
                    fontSize: 14,
                    color: isReverted ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: isReverted ? 'line-through' : 'none',
                  }}>
                    {c.description}
                  </div>
                  {oldVal != null && newVal != null && !isLow && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      {oldVal} → {newVal}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRevert(c.id)}
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    background: '#fff',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    marginLeft: 12,
                  }}
                >
                  {isReverted ? '恢复' : '撤回'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        {hasExport && sessionId && (
          <a
            href={getExportUrl(sessionId)}
            download
            style={{
              flex: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: '#fff',
              color: 'var(--text-secondary)',
              fontSize: 13,
              textDecoration: 'none',
              cursor: 'pointer',
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
