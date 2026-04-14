/**
 * 全局 message id 计数器。streamMsg / sendBotMsg 等并发流式写入
 * 必须用稳定 id 更新自己那条消息，而不是 updated[length-1]——
 * 否则两个组件同时写时会互相串改对方的最后一条。
 */
let counter = 0;

export function nextMsgId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}-${counter}`;
}
