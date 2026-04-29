/**
 * SC 工具入口页 — 跟 SdEntryView 同结构。
 */
import PixelCat from '../components/shared/PixelCat';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onStart: () => void;
  onViewExisting?: () => void;
  hasExistingDiamond?: boolean;
}

export default function ScEntryView({ onStart, onViewExisting, hasExistingDiamond }: Props) {
  return (
    <div style={{
      flex: 1, overflow: 'auto', background: '#FAFAFA',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 48px',
    }}>
      <div style={{
        maxWidth: 720, width: '100%',
        background: '#fff', borderRadius: 16,
        border: '1px solid #E2E8F0',
        padding: '48px 56px',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-block', marginBottom: 16 }}>
            <PixelCat size={56} mode="idle" />
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#0F172A',
            margin: 0, letterSpacing: -0.3,
          }}>
            战略澄清
          </h1>
          <div style={{
            fontSize: 14, color: '#64748B', marginTop: 10, lineHeight: 1.7,
          }}>
            基于 Korn Ferry 钻石模型 — 把脑子里散乱的战略想法,整理成 5 元素的结构化战略 + 6 项质量测试
          </div>
        </div>

        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}22`, borderRadius: 12,
          padding: '20px 24px', marginBottom: 28,
        }}>
          <div style={{
            fontSize: 12, color: BRAND, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
          }}>
            15-20 分钟,4 步走完
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Step n={1} title="访谈采集" desc="Sparky 用 5 道题挖出钻石模型 5 元素 — 竞争领域 / 方式 / 差异化 / 节奏 / 盈利模式,过程中会主动挑战空话" />
            <Step n={2} title="钻石模型整理" desc="把访谈输入整理成结构化战略表述 + 一句话战略" />
            <Step n={3} title="6 项质量测试" desc="基于汉姆布瑞克 / 弗雷德里克森的标准检查战略质量(适合环境 / 利用资源 / 差异化可持续 / 内部一致 / 资源足够 / 可执行)" />
            <Step n={4} title="一致性 + 完整性检查" desc="识别 5 元素之间的张力或加固,标出信息不足的 gap" />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onStart} style={primaryBtn}>
            开始战略澄清访谈 →
          </button>
          {hasExistingDiamond && onViewExisting && (
            <button onClick={onViewExisting} style={secondaryBtn}>
              看上一版钻石模型
            </button>
          )}
        </div>

        <div style={{
          marginTop: 24, fontSize: 12, color: '#94A3B8', textAlign: 'center',
          lineHeight: 1.7,
        }}>
          适用场景:已经有大致战略想法但说不清,或者刚开始系统思考战略
          <br />
          下游衔接:战略澄清产出可作为「战略解码」工具的输入,完成"战略 → 组织"完整闭环
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{
        width: 26, height: 26, borderRadius: '50%', background: BRAND,
        color: '#fff', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '11px 28px', fontSize: 14, fontWeight: 600,
  background: BRAND, color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '11px 24px', fontSize: 14, fontWeight: 500,
  background: '#fff', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 8, cursor: 'pointer',
};
