import { useState } from 'react';
import TopNav from './components/layout/TopNav';
import SparkyPanel from './components/layout/SparkyPanel';
import UploadView from './components/stage1/UploadView';
import DataConfirm from './components/stage2/DataConfirm';
import InterviewView from './components/stage3/InterviewView';
import ReportView from './components/stage4/ReportView';
import { useChat } from './hooks/useChat';
import type { Stage } from './types';
import './App.css';

function App() {
  const [stage, setStage] = useState<Stage>(1);
  const [panelVisible, setPanelVisible] = useState(true);
  const { messages, showTyping, addBotMessage, addUserMessage } = useChat([
    { role: 'bot', text: '你好！我是 Sparky，你的 AI 薪酬诊断助手。\n\n上传公司薪酬数据 Excel，我会帮你完成：\n\u2022 数据清洗与质量检查\n\u2022 市场薪酬对标匹配\n\u2022 五大模块全面诊断\n\n有任何问题随时问我。' }
  ]);

  const handleUpload = () => {
    addBotMessage('让我先看看你的数据结构...');
    setTimeout(() => setStage(2), 1500);
  };

  const handleSend = (text: string) => {
    addUserMessage(text);
    // Mock response
    setTimeout(() => {
      addBotMessage('收到，我来看看...');
    }, 800);
  };

  return (
    <div className="app-container">
      <TopNav stage={stage} />
      <div className="main-layout">
        <div className="left-panel">
          {stage === 1 && <UploadView onUpload={handleUpload} />}
          {stage === 2 && <DataConfirm onComplete={() => setStage(3)} />}
          {stage === 3 && <InterviewView onComplete={() => setStage(4)} />}
          {stage === 4 && <ReportView />}
        </div>
        <SparkyPanel
          messages={messages}
          onSend={handleSend}
          showTyping={showTyping}
          visible={panelVisible}
          onClose={() => setPanelVisible(false)}
        />
        {!panelVisible && (
          <button className="toggle-panel-btn" onClick={() => setPanelVisible(true)} title="打开 Sparky">
            💬
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
