import type { ParseResult } from '../../types';

interface StepCleansingProps {
  reverted: boolean[];
  onRevert: (idx: number) => void;
  parseResult?: ParseResult | null;
  onNext: () => void;
}

export default function StepCleansing({ reverted, onRevert, parseResult, onNext }: StepCleansingProps) {
  const corrections = parseResult?.cleansing_corrections ?? [];

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>数据清洗</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        {corrections.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>暂无修正项</div>
        ) : (
          corrections.map((c, i) => (
            <div key={c.id} className={`clean-item ${reverted[i] ? 'reverted' : ''}`}>
              <span><span className="clean-check">✓</span> {c.description}</span>
              <button className="revert-btn" onClick={() => onRevert(i)}>{reverted[i] ? '已撤回' : '撤回'}</button>
            </div>
          ))
        )}
      </div>

      <button className="next-step-btn" onClick={onNext} style={{ marginTop: 16 }}>下一步 →</button>
    </div>
  );
}
