import { useMemo } from 'react';

interface PixelCatProps {
  size?: number;
  /** 'idle' = 眨眼 + 眼珠四处看 (默认)
   *  'walk' = 在 idle 基础上,两条腿交替抬起,走路感
   *  'still' = 完全静止 */
  mode?: 'still' | 'idle' | 'walk';
}

const COLORS = {
  P: '#CA7C5E',
  D: '#a8604a',
  W: '#FFFFFF',
  E: '#3d2c24',
} as const;

type ColorKey = keyof typeof COLORS;

const COLS = 12;
const ROWS = 14;

// 静态像素 (耳朵 / 头 / 脸 / 身体) — 排除 3x3 眼睛区域和腿部
// 眼睛位置: 左 cols 1-3 / 右 cols 8-10, 都在 rows 4-6
const STATIC_PIXELS: [number, number, ColorKey][] = [
  [0, 2, 'P'], [0, 9, 'P'],
  [1, 1, 'P'], [1, 2, 'D'], [1, 3, 'P'], [1, 8, 'P'], [1, 9, 'D'], [1, 10, 'P'],
  [2, 1, 'P'], [2, 2, 'P'], [2, 3, 'P'], [2, 4, 'P'], [2, 5, 'P'],
  [2, 6, 'P'], [2, 7, 'P'], [2, 8, 'P'], [2, 9, 'P'], [2, 10, 'P'],
  [3, 0, 'P'], [3, 1, 'P'], [3, 2, 'P'], [3, 3, 'P'], [3, 4, 'P'], [3, 5, 'P'],
  [3, 6, 'P'], [3, 7, 'P'], [3, 8, 'P'], [3, 9, 'P'], [3, 10, 'P'], [3, 11, 'P'],
  [4, 0, 'P'], [4, 4, 'P'], [4, 5, 'P'], [4, 6, 'P'], [4, 7, 'P'], [4, 11, 'P'],
  [5, 0, 'P'], [5, 4, 'P'], [5, 5, 'P'], [5, 6, 'P'], [5, 7, 'P'], [5, 11, 'P'],
  [6, 0, 'P'], [6, 4, 'P'], [6, 5, 'P'], [6, 6, 'P'], [6, 7, 'P'], [6, 11, 'P'],
  [7, 0, 'P'], [7, 1, 'P'], [7, 2, 'P'], [7, 3, 'P'], [7, 4, 'P'], [7, 5, 'P'],
  [7, 6, 'P'], [7, 7, 'P'], [7, 8, 'P'], [7, 9, 'P'], [7, 10, 'P'], [7, 11, 'P'],
  [8, 0, 'P'], [8, 1, 'P'], [8, 2, 'P'], [8, 3, 'P'], [8, 4, 'P'], [8, 5, 'P'],
  [8, 6, 'P'], [8, 7, 'P'], [8, 8, 'P'], [8, 9, 'P'], [8, 10, 'P'], [8, 11, 'P'],
  [9, 1, 'P'], [9, 2, 'P'], [9, 3, 'P'], [9, 4, 'P'], [9, 5, 'P'],
  [9, 6, 'P'], [9, 7, 'P'], [9, 8, 'P'], [9, 9, 'P'], [9, 10, 'P'],
  [10, 2, 'P'], [10, 3, 'P'], [10, 4, 'P'], [10, 5, 'P'],
  [10, 6, 'P'], [10, 7, 'P'], [10, 8, 'P'], [10, 9, 'P'],
];

// 3x3 眼白 — 9 格 x 2 只 = 18 entries
const EYE_WHITES: [number, number][] = [
  [4, 1], [4, 2], [4, 3], [5, 1], [5, 2], [5, 3], [6, 1], [6, 2], [6, 3],
  [4, 8], [4, 9], [4, 10], [5, 8], [5, 9], [5, 10], [6, 8], [6, 9], [6, 10],
];

const LEFT_LEG: [number, number, ColorKey][] = [
  [11, 2, 'P'], [11, 3, 'P'],
  [12, 2, 'P'], [12, 3, 'P'],
  [13, 2, 'D'], [13, 3, 'D'],
];
const RIGHT_LEG: [number, number, ColorKey][] = [
  [11, 8, 'P'], [11, 9, 'P'],
  [12, 8, 'P'], [12, 9, 'P'],
  [13, 8, 'D'], [13, 9, 'D'],
];

export default function PixelCat({ size = 32, mode = 'idle' }: PixelCatProps) {
  const cell = size / Math.max(COLS, ROWS);
  const offX = (size - COLS * cell) / 2;
  const offY = (size - ROWS * cell) / 2;

  const lift = Math.max(1, Math.round(cell * 0.9));

  const animated = mode !== 'still';

  // 每个实例不同的随机相位偏移,避免页面上多只猫同时眨眼/抬腿
  const phase = useMemo(() => ({
    blink: -Math.random() * 6,
    walk: -Math.random() * 0.44,
  }), [mode]);

  // 闭眼线条 — 跨 3x3 眼睛宽度,垂直居中在第 5 行 (rows 4-6 中间)
  const lineH = Math.max(1, Math.round(cell * 0.5));
  const lineY = 5.5 * cell + offY - lineH / 2;
  const leftLineX = 1 * cell + offX;
  const rightLineX = 8 * cell + offX;
  const lineW = 3 * cell;

  // 眨眼时序 (6 秒一周期):前 5.7s 睁眼 → 0.15s 闭 → 0.15s 睁
  const blinkOpenValues = '1;1;0;0;1;1';
  const blinkCloseValues = '0;0;1;1;0;0';
  const blinkTimes = '0;0.94;0.95;0.98;0.99;1';
  const blinkDur = '6s';

  const renderRect = (key: string, r: number, c: number, color: string) => (
    <rect key={key} x={c * cell + offX} y={r * cell + offY} width={cell} height={cell} fill={color} />
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      <g>
        {STATIC_PIXELS.map(([r, c, k], i) => renderRect(`s-${i}`, r, c, COLORS[k]))}

        {/* 3x3 空白眼睛 — 眨眼时整组透明度 → 0,被闭眼横线替代 */}
        <g>
          {animated && (
            <animate
              attributeName="opacity"
              values={blinkOpenValues}
              keyTimes={blinkTimes}
              dur={blinkDur}
              repeatCount="indefinite"
              begin={`${phase.blink}s`}
            />
          )}
          {EYE_WHITES.map(([r, c], i) => renderRect(`w-${i}`, r, c, COLORS.W))}
        </g>

        {/* 闭眼横线 — 与瞳孔反相,眨眼瞬间出现 */}
        {animated && (
          <>
            <rect x={leftLineX} y={lineY} width={lineW} height={lineH} fill={COLORS.E} opacity={0}>
              <animate
                attributeName="opacity"
                values={blinkCloseValues}
                keyTimes={blinkTimes}
                dur={blinkDur}
                repeatCount="indefinite"
                begin={`${phase.blink}s`}
              />
            </rect>
            <rect x={rightLineX} y={lineY} width={lineW} height={lineH} fill={COLORS.E} opacity={0}>
              <animate
                attributeName="opacity"
                values={blinkCloseValues}
                keyTimes={blinkTimes}
                dur={blinkDur}
                repeatCount="indefinite"
                begin={`${phase.blink}s`}
              />
            </rect>
          </>
        )}

        {/* 左腿 — walk 模式抬起 */}
        <g>
          {mode === 'walk' && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,${-lift};0,0`}
              keyTimes="0;0.5"
              dur="0.44s"
              repeatCount="indefinite"
              calcMode="discrete"
              begin={`${phase.walk}s`}
            />
          )}
          {LEFT_LEG.map(([r, c, k], i) => renderRect(`ll-${i}`, r, c, COLORS[k]))}
        </g>

        {/* 右腿 — 与左腿反相 */}
        <g>
          {mode === 'walk' && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={`0,0;0,${-lift}`}
              keyTimes="0;0.5"
              dur="0.44s"
              repeatCount="indefinite"
              calcMode="discrete"
              begin={`${phase.walk}s`}
            />
          )}
          {RIGHT_LEG.map(([r, c, k], i) => renderRect(`rl-${i}`, r, c, COLORS[k]))}
        </g>
      </g>
    </svg>
  );
}
