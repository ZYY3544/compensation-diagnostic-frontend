import { useState, useRef, useEffect, useCallback } from 'react';
import PixelCat from '../shared/PixelCat';
import type { Message } from '../../types';

// SSE 流式解析函数（简化版，只处理 text 类型）
async function parseSseStream(
  response: Response,
  onText: (fullText: string) => void,
) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let displayedLen = 0;
  let streamDone = false;

  const RENDER_INTERVAL = 30;
  const CHARS_PER_TICK = 1;
  let renderTimer: ReturnType<typeof setInterval> | null = null;

  const startRenderLoop = () => {
    if (renderTimer) return;
    renderTimer = setInterval(() => {
      if (displayedLen < fullText.length) {
        displayedLen = Math.min(displayedLen + CHARS_PER_TICK, fullText.length);
        onText(fullText.slice(0, displayedLen));
      } else if (streamDone) {
        if (renderTimer) { clearInterval(renderTimer); renderTimer = null; }
        onText(fullText);
      }
    }, RENDER_INTERVAL);
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      streamDone = true;
      if (!renderTimer) onText(fullText);
      // Wait for render loop to finish
      await new Promise<void>(resolve => {
        if (!renderTimer) { resolve(); return; }
        const check = setInterval(() => {
          if (!renderTimer) { clearInterval(check); resolve(); }
        }, 50);
      });
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event = JSON.parse(line.slice(6));
        if (event.type === 'text') {
          fullText += event.content;
          startRenderLoop();
        }
      } catch { /* ignore malformed SSE lines */ }
    }
  }
}

interface SparkyPanelProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sessionId: string | null;
  visible: boolean;
  onClose: () => void;
  onNonChatSend?: (text: string) => boolean;
  embedded?: boolean;  // 嵌入三栏布局时隐藏自己的 header
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function SparkyPanel({ messages, setMessages, sessionId, visible, onClose, onNonChatSend, embedded }: SparkyPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChips, setSelectedChips] = useState<Record<number, string[]>>({});
  const msgEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (visible) {
      msgEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, visible]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || inputValue).trim();
    if (!text || isLoading) return;

    // If parent has a non-chat handler (Stage 2/3), try that first
    if (onNonChatSend) {
      const handled = onNonChatSend(text);
      if (handled) {
        setInputValue('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
        return;
      }
    }

    // Add user message and clear input
    setMessages(prev => [...prev, { role: 'user', text }]);
    setInputValue('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setIsLoading(true);

    // Add "thinking" message
    setMessages(prev => [...prev, { role: 'bot', text: 'Sparky 正在思考...' }]);

    if (!sessionId) {
      // No session yet (backend cold starting), try creating one on the fly
      try {
        const res = await fetch(`${API_BASE}/sessions/`, { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          // Session created, continue with chat below
          // Note: we can't set sessionId here (it's a prop), so use the ID directly
          const tempSessionId = data.id;
          const controller = new AbortController();
          abortRef.current = controller;
          try {
            const chatRes = await fetch(`${API_BASE}/chat/${tempSessionId}/stream`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: text }),
              signal: controller.signal,
            });
            if (chatRes.ok) {
              const ct = chatRes.headers.get('content-type') || '';
              if (ct.includes('text/event-stream')) {
                await parseSseStream(chatRes, (fullText) => {
                  setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'bot', text: fullText };
                    return updated;
                  });
                });
              } else {
                const chatData = await chatRes.json();
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'bot', text: chatData.response || '你好，有什么薪酬问题可以问我。' };
                  return updated;
                });
              }
              abortRef.current = null;
              setIsLoading(false);
              return;
            }
          } catch {}
          abortRef.current = null;
        }
      } catch {}
      // All attempts failed, show friendly message
      setTimeout(() => {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'bot', text: '后端服务正在启动中，请稍后再试（约 30 秒）。' };
          return updated;
        });
        setIsLoading(false);
      }, 500);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/chat/${sessionId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Check if response is SSE stream
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        await parseSseStream(res, (fullText) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: 'bot', text: fullText };
            return updated;
          });
        });
      } else {
        // Non-streaming fallback (JSON response)
        const data = await res.json();
        const reply = data.response || data.content || '抱歉，暂时无法回答。';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'bot', text: reply };
          return updated;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Chat stream failed:', err);
      // Fallback to non-stream API
      try {
        const res = await fetch(`${API_BASE}/chat/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        const data = await res.json();
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'bot', text: data.response || '抱歉，获取回复失败。' };
          return updated;
        });
      } catch {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'bot', text: '网络异常，请稍后重试。' };
          return updated;
        });
      }
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [inputValue, isLoading, sessionId, setMessages, onNonChatSend]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return; // 中文输入法防护
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className={`right-panel ${visible ? '' : 'hidden'} ${embedded ? 'embedded' : ''}`} style={embedded ? { flex: 1, width: '100%', maxWidth: 'none', border: 'none', position: 'relative' } : undefined}>
      {!embedded && (
        <div className="sparky-header">
          <div className="sparky-icon"><PixelCat size={24} /></div>
          <div style={{ flex: 1 }}>
            <div className="sparky-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Sparky
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            </div>
            <div className="sparky-subtitle">AI 诊断助手</div>
          </div>
          <button className="panel-close-btn" onClick={onClose}>✕</button>
        </div>
      )}
      <div className="sparky-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px', fontSize: 13 }}>
            有任何问题随时问我
          </div>
        )}
        {messages.map((m, i) => {
          // Render text with **bold** markdown support
          const renderMarkdown = (text: string) => {
            const parts = text.split(/(\*\*[^*]+\*\*)/g);
            return parts.map((part, idx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <div key={idx} style={{ fontWeight: 600, color: '#CA7C5E', marginTop: 8 }}>{part.slice(2, -2)}</div>;
              }
              // Trim leading newline/spaces after a bold block to prevent extra space
              const cleaned = part.replace(/^\n\s*/, '');
              if (!cleaned) return null;
              return <span key={idx}>{cleaned}</span>;
            });
          };

          const renderBotText = () => {
            if (m.role !== 'bot') return m.text;
            // Render **bold** in all bot messages
            return renderMarkdown(m.text);
          };

          const selected = selectedChips[i] || [];
          const hasChips = m.role === 'bot' && m.chips && m.chips.length > 0;

          return (
            <div key={i} className={`msg-row ${m.role === 'user' ? 'user' : ''}`}>
              {m.role === 'bot' && <div className="msg-avatar"><PixelCat size={18} /></div>}
              <div className="msg-bubble">
                {m.role === 'bot' && /^Sparky 正在.+\.\.\.$/.test(m.text) ? (
                  <>
                    <span style={{ marginRight: 8, color: 'var(--text-secondary)' }}>{m.text}</span>
                    <span className="thinking-indicator" style={{ display: 'inline-flex' }}>
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                      <span className="thinking-dot" />
                    </span>
                  </>
                ) : m.role === 'bot' ? renderBotText() : m.text}
                {hasChips && (
                  <>
                    <div style={{ borderTop: '1px solid #e5e7eb', margin: '12px 0 10px 0' }} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      {m.chips!.map((chip, ci) => {
                        const isSelected = selected.includes(chip);
                        return (
                          <button
                            key={ci}
                            onClick={() => {
                              setSelectedChips(prev => {
                                const current = prev[i] || [];
                                const updated = current.includes(chip)
                                  ? current.filter(c => c !== chip)
                                  : [...current, chip];
                                return { ...prev, [i]: updated };
                              });
                            }}
                            style={{
                              fontSize: 13,
                              padding: '5px 14px',
                              borderRadius: 16,
                              border: isSelected ? '1px solid #CA7C5E' : '1px solid #d1d5db',
                              background: isSelected ? '#CA7C5E' : '#f9fafb',
                              color: isSelected ? '#fff' : '#475569',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            {chip}
                          </button>
                        );
                      })}
                      {selected.length > 0 && (
                        <button
                          onClick={() => {
                            const answer = selected.join('、');
                            setSelectedChips(prev => ({ ...prev, [i]: [] }));
                            setMessages(prev => prev.map((msg, idx) =>
                              idx === i ? { ...msg, chips: [] } : msg
                            ));
                            sendMessage(answer);
                          }}
                          style={{
                            fontSize: 12,
                            padding: '5px 14px',
                            borderRadius: 16,
                            border: '1px solid #a8604a',
                            background: 'transparent',
                            color: '#a8604a',
                            cursor: 'pointer',
                            marginLeft: 4,
                          }}
                        >
                          确认
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={msgEnd} />
      </div>
      <div className="sparky-input-area">
        <div className="sparky-input-wrapper">
          <textarea
            ref={inputRef}
            className="sparky-input"
            placeholder="输入消息..."
            value={inputValue}
            onChange={e => {
              setInputValue(e.target.value);
              if (e.target.value) {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              } else {
                e.target.style.height = 'auto';
              }
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />
          <div className="sparky-input-bottom">
            <button
              className="sparky-send"
              onClick={() => sendMessage()}
              disabled={!inputValue.trim() || isLoading}
            >↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
