interface Props {
  percent: number; // 0-100
  size?: number; // px
  thickness?: number; // px
  trackColorClass?: string;
  fillColor?: string; // css color string
}

export default function ProgressRing({ percent, size = 80, thickness = 10, trackColorClass = "bg-muted", fillColor = "hsl(var(--primary))" }: Props) {
  const radius = size / 2;
  const inner = size - thickness * 2;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    background: `conic-gradient(${fillColor} ${percent * 3.6}deg, hsl(var(--muted)) ${percent * 3.6}deg)`,
  };
  return (
    <div className="relative rounded-full shadow-inner" style={style} aria-label={`Fortschritt ${Math.round(percent)}%`}>
      <div
        className={`absolute inset-0 m-auto rounded-full ${trackColorClass}`}
        style={{ width: inner, height: inner }}
      />
    </div>
  );
}
