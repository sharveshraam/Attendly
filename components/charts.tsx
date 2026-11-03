"use client";

/** Dependency-free, responsive SVG charts. No external data or fake values. */

export interface TrendPoint { label: string; value: number | null }

export function TrendChart({ points, target, height = 180, label = "Attendance trend" }: {
  points: TrendPoint[]; target?: number; height?: number; label?: string;
}) {
  const width = 640;
  const padding = { top: 14, right: 14, bottom: 26, left: 34 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const valid = points.filter((point) => point.value !== null);
  if (valid.length === 0) {
    return <p className="muted" style={{ fontSize: 12, padding: "24px 0", textAlign: "center" }}>No marked classes yet to chart.</p>;
  }
  const y = (value: number) => padding.top + innerH - (value / 100) * innerH;
  const x = (index: number) => padding.left + (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const path = points
    .map((point, index) => (point.value === null ? "" : `${index === 0 || points[index - 1]?.value === null ? "M" : "L"} ${x(index)} ${y(point.value)}`))
    .filter(Boolean)
    .join(" ");
  const area = `${path} L ${x(points.length - 1)} ${padding.top + innerH} L ${padding.left} ${padding.top + innerH} Z`;

  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <title>{label}</title>
        {[0, 25, 50, 75, 100].map((tick) => (
          <g key={tick}>
            <line className="chart-grid" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} />
            <text className="chart-label" x={4} y={y(tick) + 3}>{tick}</text>
          </g>
        ))}
        {typeof target === "number" && (
          <line x1={padding.left} x2={width - padding.right} y1={y(target)} y2={y(target)} stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="5 4" />
        )}
        <path d={area} fill="var(--accent)" opacity="0.10" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) =>
          point.value === null ? null : (
            <circle key={index} cx={x(index)} cy={y(point.value)} r="3.2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2">
              <title>{`${point.label}: ${point.value}%`}</title>
            </circle>
          ),
        )}
        {points.map((point, index) =>
          index % Math.max(1, Math.ceil(points.length / 7)) === 0 ? (
            <text key={`l${index}`} className="chart-label" x={x(index)} y={height - 6} textAnchor="middle">{point.label}</text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

export function BarChart({ items, label = "Course attendance comparison", target }: {
  items: { label: string; value: number | null; color?: string }[]; target?: number; label?: string;
}) {
  const width = 640;
  const rowH = 34;
  const height = Math.max(60, items.length * rowH + 24);
  const labelW = 150;
  const barW = width - labelW - 54;
  if (items.length === 0) return <p className="muted" style={{ fontSize: 12, padding: "20px 0", textAlign: "center" }}>No courses to compare yet.</p>;
  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <title>{label}</title>
        {typeof target === "number" && (
          <line x1={labelW + (target / 100) * barW} x2={labelW + (target / 100) * barW} y1={8} y2={height - 18} stroke="var(--warning)" strokeDasharray="4 4" strokeWidth="1.5" />
        )}
        {items.map((item, index) => {
          const cy = 18 + index * rowH;
          const value = item.value ?? 0;
          return (
            <g key={item.label}>
              <text className="chart-label" x={0} y={cy + 4} style={{ fontSize: 11 }}>{item.label.length > 22 ? `${item.label.slice(0, 21)}…` : item.label}</text>
              <rect x={labelW} y={cy - 8} width={barW} height={16} rx={8} fill="var(--surface-3)" />
              <rect x={labelW} y={cy - 8} width={Math.max(0, Math.min(barW, (value / 100) * barW))} height={16} rx={8} fill={item.color ?? "var(--accent)"} />
              <text className="chart-label" x={labelW + barW + 8} y={cy + 4}>{item.value === null ? "—" : `${item.value}%`}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function Heatmap({ days, label = "Attendance calendar heatmap" }: {
  days: { date: string; percent: number | null; title?: string }[]; label?: string;
}) {
  const color = (percent: number | null) => {
    if (percent === null) return "var(--surface-3)";
    if (percent >= 85) return "var(--accent)";
    if (percent >= 70) return "color-mix(in srgb, var(--accent) 70%, var(--surface))";
    if (percent >= 50) return "var(--warning)";
    return "var(--danger)";
  };
  return (
    <div role="img" aria-label={label} className="heatmap">
      {days.map((day) => (
        <span key={day.date} className="heat-cell" style={{ background: color(day.percent) }} title={day.title ?? `${day.date}: ${day.percent === null ? "no marked classes" : `${day.percent}%`}`} />
      ))}
    </div>
  );
}

export function ProgressRing({ value, size = 108, label }: { value: number | null; size?: number; label?: string }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (percent / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `Attendance ${value === null ? "unavailable" : `${value}%`}`}>
      <title>{label ?? "Attendance"}</title>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="9" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={value === null ? "var(--faint)" : percent >= 75 ? "var(--accent)" : "var(--danger)"}
        strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" style={{ fill: "var(--text)", fontSize: 21, fontWeight: 700, letterSpacing: "-0.04em" }}>
        {value === null ? "—" : `${value}%`}
      </text>
      <text x="50%" y="66%" textAnchor="middle" style={{ fill: "var(--faint)", fontSize: 9.5 }}>attendance</text>
    </svg>
  );
}
