import { useState, useCallback } from 'react';
import type { Message } from '../types';

export function useChat(initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [showTyping, setShowTyping] = useState(false);

  const addMessage = useCallback((msg: Message) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const addBotMessage = useCallback((text: string, delay = 800) => {
    return new Promise<void>((resolve) => {
      setShowTyping(true);
      setTimeout(() => {
        setShowTyping(false);
        setMessages(prev => [...prev, { role: 'bot', text }]);
        resolve();
      }, delay);
    });
  }, []);

  const addUserMessage = useCallback((text: string) => {
    setMessages(prev => [...prev, { role: 'user', text }]);
  }, []);

  return { messages, showTyping, setShowTyping, addMessage, addBotMessage, addUserMessage };
}
