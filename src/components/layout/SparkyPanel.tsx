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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, showTyping]);

  const handleSubmit = () => {
    if (!input.trim()) return;
    onSend(input.trim());
    setInput('');
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
            <div className="msg-bubble typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="sparky-input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="输入消息..."
          className="sparky-input"
        />
        <button className="sparky-send-btn" onClick={handleSubmit}>↑</button>
      </div>
    </div>
  );
}
