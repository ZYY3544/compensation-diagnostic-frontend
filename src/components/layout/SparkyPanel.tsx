import { useState, useRef, useEffect } from 'react';
import PixelCat from '../shared/PixelCat';
import type { Message } from '../../types';

interface SparkyPanelProps {
  messages: Message[];
  onSend: (text: string) => void;
  showTyping: boolean;
  visible: boolean;
  onClose: () => void;
}

export default function SparkyPanel({ messages, onSend, showTyping, visible, onClose }: SparkyPanelProps) {
  const [input, setInput] = useState('');
  const msgEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className={`right-panel ${visible ? '' : 'hidden'}`}>
      <div className="sparky-header">
        <div className="sparky-icon"><PixelCat size={24} /></div>
        <div style={{ flex: 1 }}>
          <div className="sparky-title">Sparky</div>
          <div className="sparky-subtitle">AI 诊断助手</div>
        </div>
        <button className="panel-close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="sparky-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg-row ${m.role === 'user' ? 'user' : ''}`}>
            {m.role === 'bot' && <div className="msg-avatar"><PixelCat size={18} /></div>}
            <div className="msg-bubble">{m.text}</div>
          </div>
        ))}
        {showTyping && (
          <div className="msg-row">
            <div className="msg-avatar"><PixelCat size={18} /></div>
            <div className="msg-bubble">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={msgEnd} />
      </div>
      <div className="sparky-input-area">
        <input
          className="sparky-input"
          placeholder="输入消息..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
        />
        <button className="sparky-send" onClick={handleSend}>↑</button>
      </div>
    </div>
  );
}
