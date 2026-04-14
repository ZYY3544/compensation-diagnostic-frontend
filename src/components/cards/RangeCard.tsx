/**
 * RangeCard: 候选人定薪定位卡
 * 在 P25-P75 之间的数轴上，标出候选人期望薪资 + 公司内部同级中位值
 * 声明式 props：
 * {
 *   type: 'RangeCard',
 *   title: '候选人定位',
 *   range_min: 'market.p25',
 *   range_max: 'market.p75',
 *   marker: 'candidate.ask',
 *   internal_median: 'internal.same_grade_median',
 *   description: '仅在有候选人期望薪资时展示'
 * }
 */
import { getValueByPath } from './utils';

interface Props {
  config: {
    type: 'RangeCard';
    title?: string;
    range_min: string;
    range_max: string;
    marker: string;
    internal_median?: string;
    description?: string;
  };
  data: any;
}

export default function RangeCard({ config, data }: Props) {
  const pMin = Number(getValueByPath(data, config.range_min) || 0);
  const pMax = Number(getValueByPath(data, config.range_max) || 0);
  const candidate = Number(getValueByPath(data, config.marker) || 0);
  const internal = config.internal_median ? Number(getValueByPath(data, config.internal_median) || 0) : null;

  // 如果没有候选人期望，不展示
  if (!candidate) {
    if (config.description) {
      return (
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>
          {config.description}
        </div>
      );
    }
    return null;
  }

  const range = Math.max(pMax - pMin, 1);
  const candPos = Math.max(0, Math.min(100, ((candidate - pMin) / range) * 100));
  const intPos = internal ? Math.max(0, Math.min(100, ((internal - pMin) / range) * 100)) : null;

  // 候选人位置判断
  let candStatus = 'ok';
  let candDesc = '';
  if (candidate < pMin) { candStatus = 'low'; candDesc = '低于市场 P25'; }
  else if (candidate < (pMin + pMax) / 2) { candStatus = 'ok'; candDesc = '市场 P25-P50 之间'; }
  else if (candidate < pMax) { candStatus = 'high'; candDesc = '市场 P50-P75 之间'; }
  else { candStatus = 'very_high'; candDesc = '超过市场 P75'; }

  const candColor = { low: '#27ae60', ok: '#27ae60', high: '#e67e22', very_high: '#dc3545' }[candStatus] || '#2563eb';

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>{config.title}</div>
      )}

      {/* 范围轴 */}
      <div style={{ position: 'relative', height: 80, marginTop: 30, marginBottom: 16 }}>
        {/* 灰色背景条 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 30, height: 8,
          background: '#f0f1f4', borderRadius: 4,
        }} />
        {/* 绿色合理范围条 */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 30, height: 8,
          background: 'linear-gradient(90deg, #d4edda 0%, #fff3cd 50%, #f8d7da 100%)',
          borderRadius: 4,
        }} />

        {/* P25 / P50 / P75 刻度 */}
        {[0, 50, 100].map((p, i) => {
          const label = ['P25', 'P50', 'P75'][i];
          const val = [pMin, (pMin + pMax) / 2, pMax][i];
          return (
            <div key={p} style={{ position: 'absolute', left: `${p}%`, top: 30, transform: 'translateX(-50%)' }}>
              <div style={{ width: 2, height: 16, background: '#6b6b7e', marginTop: -4 }} />
              <div style={{ fontSize: 10, color: '#6b6b7e', marginTop: 16, textAlign: 'center', whiteSpace: 'nowrap' }}>
                {label}
              </div>
              <div style={{ fontSize: 11, color: '#1a1a2e', fontWeight: 500, marginTop: 2, textAlign: 'center', whiteSpace: 'nowrap' }}>
                ¥{_format(val)}
              </div>
            </div>
          );
        })}

        {/* 内部中位标记（灰色圆点）*/}
        {intPos != null && (
          <div style={{
            position: 'absolute', left: `${intPos}%`, top: 20, transform: 'translateX(-50%)',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#a0a0b0', border: '2px solid #fff' }} />
            <div style={{ fontSize: 10, color: '#6b6b7e', marginTop: 4, whiteSpace: 'nowrap', textAlign: 'center' }}>
              内部中位
            </div>
          </div>
        )}

        {/* 候选人期望标记（彩色三角）*/}
        <div style={{
          position: 'absolute', left: `${candPos}%`, top: -5, transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: 0, height: 0,
            borderLeft: '8px solid transparent', borderRight: '8px solid transparent',
            borderTop: `12px solid ${candColor}`,
            margin: '0 auto',
          }} />
        </div>
      </div>

      {/* 候选人信息 */}
      <div style={{
        background: '#f7f8fa', borderRadius: 8, padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#8b8b9e', marginBottom: 3 }}>候选人期望</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: candColor }}>¥{_format(candidate)}</div>
        </div>
        <div style={{ fontSize: 12, color: '#6b6b7e', textAlign: 'right' }}>{candDesc}</div>
      </div>
    </div>
  );
}

function _format(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
  return v.toLocaleString();
}
