import type { ParseResult } from '../../types';

interface StepCleansingProps {
  taxChoice: string | null;
  onTaxChoice: (choice: string) => void;
  reverted: boolean[];
  onRevert: (idx: number) => void;
  parseResult?: ParseResult | null;
}

const mockCorrections = [
  { id: 0, description: '第 5、12、30 行年终奖已年化处理（入司不满 1 年）', type: 'annualize_bonus' },
  { id: 1, description: '全部员工 13 薪已从年终奖移入固定薪酬', type: '13th_month_reclassify' },
  { id: 2, description: '第 45 行月薪 ¥85,000 已标记为异常值', type: 'extreme_value' },
];

export default function StepCleansing({ taxChoice, onTaxChoice, reverted, onRevert, parseResult }: StepCleansingProps) {
  const corrections = parseResult?.cleansing_corrections ?? mockCorrections;
  const completenessScore = parseResult?.data_completeness_score ?? 78;

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>数据清洗</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        {corrections.map((c, i) => (
          <div key={c.id} className={`clean-item ${reverted[i] ? 'reverted' : ''}`}>
            <span><span className="clean-check">✓</span> {c.description}</span>
            <button className="revert-btn" onClick={() => onRevert(i)}>{reverted[i] ? '已撤回' : '撤回'}</button>
          </div>
        ))}
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
    </div>
  );
}
