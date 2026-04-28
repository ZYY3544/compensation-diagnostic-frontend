import { useMemo } from 'react';

interface PixelCatProps {
  size?: number;
  /** 'idle' = 呼吸 + 眨眼 + 眼珠四处看 (默认)
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

// 静态像素 (耳朵 / 头 / 脸 / 鼻子 / 胡须 / 身体) — 排除 2x2 眼睛区域和腿部
const STATIC_PIXELS: [number, number, ColorKey][] = [
  [0, 2, 'P'], [0, 9, 'P'],
  [1, 1, 'P'], [1, 2, 'D'], [1, 3, 'P'], [1, 8, 'P'], [1, 9, 'D'], [1, 10, 'P'],
  [2, 1, 'P'], [2, 2, 'P'], [2, 3, 'P'], [2, 4, 'P'], [2, 5, 'P'],
  [2, 6, 'P'], [2, 7, 'P'], [2, 8, 'P'], [2, 9, 'P'], [2, 10, 'P'],
  [3, 0, 'P'], [3, 1, 'P'], [3, 2, 'P'], [3, 3, 'P'], [3, 4, 'P'], [3, 5, 'P'],
  [3, 6, 'P'], [3, 7, 'P'], [3, 8, 'P'], [3, 9, 'P'], [3, 10, 'P'], [3, 11, 'P'],
  [4, 0, 'P'], [4, 1, 'P'], [4, 4, 'P'], [4, 5, 'P'],
  [4, 6, 'P'], [4, 7, 'P'], [4, 10, 'P'], [4, 11, 'P'],
  [5, 0, 'P'], [5, 1, 'P'], [5, 4, 'P'], [5, 5, 'P'],
  [5, 6, 'P'], [5, 7, 'P'], [5, 10, 'P'], [5, 11, 'P'],
  [6, 0, 'P'], [6, 1, 'P'], [6, 2, 'P'], [6, 3, 'P'], [6, 4, 'P'],
  [6, 5, 'D'], [6, 6, 'D'],
  [6, 7, 'P'], [6, 8, 'P'], [6, 9, 'P'], [6, 10, 'P'], [6, 11, 'P'],
  [7, 0, 'P'], [7, 1, 'P'], [7, 2, 'P'], [7, 3, 'P'],
  [7, 4, 'D'], [7, 5, 'P'], [7, 6, 'P'], [7, 7, 'D'],
  [7, 8, 'P'], [7, 9, 'P'], [7, 10, 'P'], [7, 11, 'P'],
  [8, 0, 'P'], [8, 1, 'P'], [8, 2, 'P'], [8, 3, 'P'], [8, 4, 'P'], [8, 5, 'P'],
  [8, 6, 'P'], [8, 7, 'P'], [8, 8, 'P'], [8, 9, 'P'], [8, 10, 'P'], [8, 11, 'P'],
  [9, 1, 'P'], [9, 2, 'P'], [9, 3, 'P'], [9, 4, 'P'], [9, 5, 'P'],
  [9, 6, 'P'], [9, 7, 'P'], [9, 8, 'P'], [9, 9, 'P'], [9, 10, 'P'],
  [10, 2, 'P'], [10, 3, 'P'], [10, 4, 'P'], [10, 5, 'P'],
  [10, 6, 'P'], [10, 7, 'P'], [10, 8, 'P'], [10, 9, 'P'],
];

const EYE_WHITES: [number, number][] = [
  [4, 2], [4, 3], [5, 2], [5, 3],
  [4, 8], [4, 9], [5, 8], [5, 9],
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
  const PAD = 2;
  const cell = (size - PAD * 2) / Math.max(COLS, ROWS);
  const offX = (size - COLS * cell) / 2;
  const offY = (size - ROWS * cell) / 2;

  // 量化到整数像素 — 像素艺术应该整数跳变
  const bobAmp = Math.max(1, Math.round(cell * (mode === 'walk' ? 0.7 : 0.5)));
  const lift = Math.max(1, Math.round(cell * 0.9));

  const animated = mode !== 'still';

  // 每个实例不同的随机相位偏移,避免页面上多只猫同时眨眼/晃动
  const phase = useMemo(() => ({
    bob: -Math.random() * (mode === 'walk' ? 0.22 : 0.76),
    blink: -Math.random() * 6,
    dart: -Math.random() * 9,
    walk: -Math.random() * 0.44,
  }), [mode]);

  const bobDur = mode === 'walk' ? '0.22s' : '0.76s';

  // 瞳孔默认位置
  const pupilLeftX = 3 * cell + offX;
  const pupilLeftY = 5 * cell + offY;
  const pupilRightX = 9 * cell + offX;
  const pupilRightY = 5 * cell + offY;

  // 闭眼线条
  const lineH = Math.max(1, Math.round(cell * 0.5));
  const lineY = 5 * cell + offY - lineH / 2;
  const leftLineX = 2 * cell + offX;
  const rightLineX = 8 * cell + offX;
  const lineW = 2 * cell;

  // 眨眼时序 (6 秒一周期):前 5.7s 睁眼 → 0.15s 闭 → 0.15s 睁
  const blinkOpenValues = '1;1;0;0;1;1';
  const blinkCloseValues = '0;0;1;1;0;0';
  const blinkTimes = '0;0.94;0.95;0.98;0.99;1';
  const blinkDur = '6s';

  // 眼珠 dart 时序 (9 秒一周期):中心 → 左 → 中心 → 上 → 中心 → 左上 → 中心
  const dartValues = `0,0; ${-cell},0; 0,0; 0,${-cell}; 0,0; ${-cell},${-cell}; 0,0`;
  const dartTimes = '0;0.16;0.3;0.46;0.6;0.78;1';
  const dartDur = '9s';

  const renderRect = (key: string, r: number, c: number, color: string) => (
    <rect key={key} x={c * cell + offX} y={r * cell + offY} width={cell} height={cell} fill={color} />
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {/* 整体身体 — bob 上下呼吸 */}
      <g>
        {animated && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values={`0,0;0,${-bobAmp}`}
            keyTimes="0;0.5"
            dur={bobDur}
            repeatCount="indefinite"
            calcMode="discrete"
            begin={`${phase.bob}s`}
          />
        )}

        {STATIC_PIXELS.map(([r, c, k], i) => renderRect(`s-${i}`, r, c, COLORS[k]))}
        {EYE_WHITES.map(([r, c], i) => renderRect(`w-${i}`, r, c, COLORS.W))}

        {/* 瞳孔 — dart 偏移 + 眨眼时透明度 → 0 */}
        <g>
          {animated && (
            <animateTransform
              attributeName="transform"
              type="translate"
              values={dartValues}
              keyTimes={dartTimes}
              dur={dartDur}
              repeatCount="indefinite"
              calcMode="discrete"
              begin={`${phase.dart}s`}
            />
          )}
          <rect x={pupilLeftX} y={pupilLeftY} width={cell} height={cell} fill={COLORS.E}>
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
          </rect>
          <rect x={pupilRightX} y={pupilRightY} width={cell} height={cell} fill={COLORS.E}>
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
          </rect>
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
