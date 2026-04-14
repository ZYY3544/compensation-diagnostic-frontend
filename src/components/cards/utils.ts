/**
 * 卡片组件通用工具：路径解析 + 格式化 + 颜色规则
 */

export function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return null;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur;
}

export function formatValue(value: any, format?: string): string | number | null {
  if (value == null) return null;
  if (!format) return value;

  // 货币
  if (format === 'currency') {
    const num = Number(value);
    if (isNaN(num)) return String(value);
    if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`;
    return `¥${num.toLocaleString()}`;
  }

  // 模板替换 {value}
  if (format.includes('{value}')) {
    return format.replace('{value}', String(value));
  }

  return value;
}

/**
 * 色彩规则解析，如：'<25 red, 25-50 orange, >50 green'
 */
export function applyColorRule(value: any, rule?: string): string {
  if (!rule || value == null) return 'inherit';
  const num = Number(value);
  if (isNaN(num)) return 'inherit';

  const segments = rule.split(',').map(s => s.trim());
  for (const seg of segments) {
    const [cond, color] = seg.split(/\s+/);
    if (!cond || !color) continue;
    const hex = _colorMap(color);

    if (cond.startsWith('<')) {
      const bound = Number(cond.slice(1));
      if (num < bound) return hex;
    } else if (cond.startsWith('>')) {
      const bound = Number(cond.slice(1));
      if (num > bound) return hex;
    } else if (cond.includes('-')) {
      const [lo, hi] = cond.split('-').map(Number);
      if (num >= lo && num <= hi) return hex;
    }
  }
  return 'inherit';
}

function _colorMap(name: string): string {
  const mp: Record<string, string> = {
    red: '#dc3545',
    orange: '#e67e22',
    green: '#27ae60',
    blue: '#2563eb',
    grey: '#6b6b7e',
    yellow: '#f39c12',
  };
  return mp[name.toLowerCase()] || name;
}
