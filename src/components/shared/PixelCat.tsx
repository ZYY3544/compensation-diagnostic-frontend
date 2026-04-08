interface PixelCatProps {
  size?: number;
}

export default function PixelCat({ size = 32 }: PixelCatProps) {
  const P = '#CA7C5E', D = '#a8604a', W = '#FFFFFF', E = '#3d2c24', _ = 'transparent';
  const pixels = [
    [_,_,P,_,_,_,_,_,_,P,_,_],
    [_,P,D,P,_,_,_,_,P,D,P,_],
    [_,P,P,P,P,P,P,P,P,P,P,_],
    [P,P,P,P,P,P,P,P,P,P,P,P],
    [P,P,W,W,P,P,P,P,W,W,P,P],
    [P,P,W,E,P,P,P,P,W,E,P,P],
    [P,P,P,P,P,D,D,P,P,P,P,P],
    [P,P,P,P,D,P,P,D,P,P,P,P],
    [P,P,P,P,P,P,P,P,P,P,P,P],
    [_,P,P,P,P,P,P,P,P,P,P,_],
    [_,_,P,P,P,P,P,P,P,P,_,_],
    [_,_,P,P,_,_,_,_,P,P,_,_],
    [_,_,P,P,_,_,_,_,P,P,_,_],
    [_,_,D,D,_,_,_,_,D,D,_,_],
  ];
  const cols = 12, rows = 14, cell = size / Math.max(cols, rows);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {pixels.map((row, r) => row.map((color, c) =>
        color !== _ ? <rect key={`${r}-${c}`} x={c*cell+(size-cols*cell)/2} y={r*cell+(size-rows*cell)/2} width={cell} height={cell} fill={color} /> : null
      ))}
    </svg>
  );
}
