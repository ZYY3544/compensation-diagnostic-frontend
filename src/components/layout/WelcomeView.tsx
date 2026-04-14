import PixelCat from '../shared/PixelCat';

interface Chip {
  label: string;       // 完整 chip 文案（可能带 emoji）
  onClick: () => void;
}

interface Props {
  chips?: Chip[];
}

// 剥掉 chip 文案开头的 emoji / 符号 + 空格，Claude 风格：chip 里只放纯文字
function stripLeadingEmoji(label: string): string {
  return label.replace(/^[^A-Za-z0-9\u4e00-\u9fa5]+\s*/, '').trim();
}

/**
 * 欢迎页 Hero 内容：logo + 标题 + 副标题 + 2×2 chip 网格。
 * 嵌在 SparkyPanel 的消息区顶部，输入框保持在底部常驻，所以这里不再包含 input。
 */
export default function WelcomeView({ chips = [] }: Props) {
  return (
    <div className="welcome-hero">
      <PixelCat size={48} />
      <h1 className="welcome-title">你好，我是 Sparky</h1>
      <p className="welcome-sub">
        你的 AI 薪酬顾问。不管是做一次完整的薪酬诊断，还是快速查一个岗位的市场行情，直接跟我说就行。
      </p>
      {chips.length > 0 && (
        <div className="welcome-chips">
          {chips.map((c, i) => (
            <button
              key={i}
              className="welcome-chip"
              onClick={c.onClick}
            >
              {stripLeadingEmoji(c.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
