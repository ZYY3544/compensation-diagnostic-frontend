/**
 * SD 工具入口页 — 简单的 hero + CTA。
 * 跟 JeEntryView 不同的是,SD V1 只有一条路径(战略澄清访谈 → 解码地图),
 * 所以入口页没必要给多个 path,只展示价值主张 + 一个开始按钮。
 */
import PixelCat from '../components/shared/PixelCat';

const BRAND = '#D85A30';
const BRAND_TINT = '#FEF7F4';

interface Props {
  onStart: () => void;
  onViewExisting?: () => void;
  hasExistingDecoding?: boolean;
}

export default function SdEntryView({ onStart, onViewExisting, hasExistingDecoding }: Props) {
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
        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-block', marginBottom: 16 }}>
            <PixelCat size={56} mode="idle" />
          </div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: '#0F172A',
            margin: 0, letterSpacing: -0.3,
          }}>
            战略解码
          </h1>
          <div style={{
            fontSize: 14, color: '#64748B', marginTop: 10, lineHeight: 1.7,
          }}>
            把战略翻译到部门 KPI、关键岗位、能力建设、季度路线图 — 让每个人都知道未来 1 年要交付什么
          </div>
        </div>

        {/* 流程说明 */}
        <div style={{
          background: BRAND_TINT, border: `1px solid ${BRAND}22`, borderRadius: 12,
          padding: '20px 24px', marginBottom: 28,
        }}>
          <div style={{
            fontSize: 12, color: BRAND, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
          }}>
            10-15 分钟,4 步走完
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Step n={1} title="访谈采集" desc="Sparky 用 5 道题挖出你们的愿景 / 业务模式 / 增长机会 / 核心能力 / 关键约束" />
            <Step n={2} title="自动解码" desc="基于钻石模型 (Korn Ferry) + 6 项一致性检查,翻译成可执行的解码地图" />
            <Step n={3} title="部门翻译" desc="每个核心部门的 critical outcomes + KPIs + 关键岗位 + 能力建设" />
            <Step n={4} title="季度路线图" desc="未来 4 个季度的关键里程碑,可直接喂给季度规划会" />
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onStart} style={primaryBtn}>
            开始战略澄清访谈 →
          </button>
          {hasExistingDecoding && onViewExisting && (
            <button onClick={onViewExisting} style={secondaryBtn}>
              看上一版解码地图
            </button>
          )}
        </div>

        <div style={{
          marginTop: 24, fontSize: 12, color: '#94A3B8', textAlign: 'center',
          lineHeight: 1.7,
        }}>
          适用场景:已经有大致战略方向,需要把它翻译到组织、部门、岗位层面
          <br />
          不适用:战略方向都还没定,需要先做战略澄清研讨会(那是另一个工具,V2 见)
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
