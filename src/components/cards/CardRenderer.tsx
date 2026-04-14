/**
 * CardRenderer: 读 render_components 声明数组，按 type 渲染对应卡片。
 *
 * 新增卡片类型的步骤：
 *   1. 新建 XxxCard.tsx，props = { config, data }
 *   2. 在 CARD_COMPONENTS map 里加一条
 */
import MetricGrid from './MetricGrid';
import BarHCard from './BarHCard';
import ComparisonTable from './ComparisonTable';
import LineChartCard from './LineChartCard';
import StackedBarCard from './StackedBarCard';
import BoxPlotCard from './BoxPlotCard';
import RangeCard from './RangeCard';

const CARD_COMPONENTS: Record<string, any> = {
  MetricGrid,
  BarHCard,
  ComparisonTable,
  LineChartCard,
  StackedBarCard,
  BoxPlotCard,
  RangeCard,
};

interface Props {
  /** skill 声明的 render_components 数组 */
  components: Array<{ type: string; [key: string]: any }>;
  /** engine 返回的 result */
  data: any;
  /** Sparky 生成的解读文案，渲染在顶部 */
  narrative?: string;
  /** 整体标题（可选） */
  title?: string;
  /** 标题下的副标题（如数据来源） */
  subtitle?: string;
}

export default function CardRenderer({ components, data, narrative, title, subtitle }: Props) {
  return (
    <div>
      {title && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#6b6b7e', marginBottom: 2 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: '#a0a0b0' }}>{subtitle}</div>}
        </div>
      )}

      {/* Sparky 解读（如果有） */}
      {narrative && (
        <div style={{
          background: '#fff3e6', border: '1px solid #ffd7a8',
          borderRadius: 12, padding: '14px 18px', marginBottom: 14,
          fontSize: 13, color: '#5a3b1a', lineHeight: 1.7,
        }}>
          🐻 {narrative}
        </div>
      )}

      {/* 卡片堆栈 */}
      {components.map((cfg, i) => {
        const Comp = CARD_COMPONENTS[cfg.type];
        if (!Comp) {
          return (
            <div key={i} style={{
              background: '#fff', border: '1px dashed #dc3545',
              borderRadius: 12, padding: 16, marginBottom: 14,
              fontSize: 12, color: '#dc3545',
            }}>
              ⚠ 未实现的卡片类型：{cfg.type}
            </div>
          );
        }
        return (
          <div key={i} style={{
            background: '#fff', border: '1px solid #e8e8ec',
            borderRadius: 12, padding: 20, marginBottom: 14,
          }}>
            <Comp config={cfg} data={data} />
          </div>
        );
      })}
    </div>
  );
}
