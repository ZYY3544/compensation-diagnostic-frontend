import type { ParseResult } from '../../types';

interface StepCleansingProps {
  taxChoice: string | null;
  onTaxChoice: (choice: string) => void;
  reverted: boolean[];
  onRevert: (idx: number) => void;
  parseResult?: ParseResult | null;
  onNext: () => void;
}

export default function StepCleansing({ taxChoice, onTaxChoice, reverted, onRevert, parseResult, onNext }: StepCleansingProps) {
  const corrections = parseResult?.cleansing_corrections ?? [];
  const completenessScore = parseResult?.data_completeness_score ?? 0;

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

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div className="confirm-bar">
          <span>⚠ 请确认薪酬数据口径</span>
          <div className="confirm-bar-btns">
            <button
              className={`confirm-bar-btn ${taxChoice === 'pre' ? 'selected' : taxChoice === 'post' ? 'deselected' : ''}`}
              onClick={() => onTaxChoice('pre')}
            >税前</button>
            <button
              className={`confirm-bar-btn ${taxChoice === 'post' ? 'selected' : taxChoice === 'pre' ? 'deselected' : ''}`}
              onClick={() => onTaxChoice('post')}
            >税后</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
        数据完整度 {completenessScore}%
        <span className="progress-bar-track" style={{ marginLeft: 8, width: 120 }}>
          <span className="progress-bar-fill" style={{ width: `${completenessScore}%` }}></span>
        </span>
      </div>

      <button className="next-step-btn" onClick={onNext} style={{ marginTop: 16 }}>下一步 →</button>
    </div>
  );
}
