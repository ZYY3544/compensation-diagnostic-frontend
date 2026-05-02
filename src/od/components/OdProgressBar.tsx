/**
 * 组织诊断 OD 工具的顶部进度条 — 4 阶段切换 + 跳转。
 *
 * 阶段: frame (破题) → method (方法论) → interview (访谈) → diagnosis (报告)
 *
 * 行为:
 *   - 当前阶段高亮
 *   - 已完成阶段可点击回看
 *   - 未来阶段在没有前置条件时显示为锁定 (灰色), 但仍允许"跳到此处"
 *   - 报告阶段没有诊断时不可点
 */
import type { OdStage } from '../OdApp';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  current: OdStage;
  hasDiagnosis: boolean;
  onJump: (stage: OdStage) => void;
}

const STEPS: { key: OdStage; label: string; sub: string }[] = [
  { key: 'frame', label: '破题', sub: '诊断什么 / 适合谁' },
  { key: 'method', label: '方法论', sub: 'KF 框架 + 4 渠道' },
  { key: 'interview', label: '访谈', sub: '5 层 5 题深挖 (高管)' },
  { key: 'survey', label: '员工调研', sub: 'Double E 40 题 (员工)' },
  { key: 'diagnosis', label: '报告', sub: '诊断 + 优化建议' },
];

export default function OdProgressBar({ current, hasDiagnosis, onJump }: Props) {
  const currentIdx = STEPS.findIndex(s => s.key === current);

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      padding: '12px 24px', background: '#fff',
      borderBottom: '1px solid #E2E8F0',
      flexShrink: 0,
    }}>
      {STEPS.map((step, idx) => {
        const isCurrent = step.key === current;
        const isPast = idx < currentIdx;
        const isLocked = step.key === 'diagnosis' && !hasDiagnosis;
        const clickable = !isLocked;

        return (
          <div key={step.key} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, minWidth: 0 }}>
            <div
              onClick={clickable ? () => onJump(step.key) : undefined}
              style={{
                flex: 1, minWidth: 0,
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                cursor: clickable ? 'pointer' : 'not-allowed',
                background: isCurrent ? BRAND_TINT : 'transparent',
                opacity: isLocked ? 0.4 : 1,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                if (clickable && !isCurrent) (e.currentTarget as HTMLDivElement).style.background = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isCurrent ? BRAND : (isPast ? '#16A34A' : '#E2E8F0'),
                color: isCurrent || isPast ? '#fff' : '#94A3B8',
                fontSize: 12, fontWeight: 600, flexShrink: 0,
              }}>
                {isPast ? '✓' : idx + 1}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 13, fontWeight: isCurrent ? 600 : 500,
                  color: isCurrent ? BRAND : '#0F172A',
                  marginBottom: 1,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {step.label}
                </div>
                <div style={{
                  fontSize: 11, color: '#94A3B8',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {step.sub}
                </div>
              </div>
            </div>

            {idx < STEPS.length - 1 && (
              <div style={{
                width: 16, height: 1.5, background: '#E2E8F0', flexShrink: 0,
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
