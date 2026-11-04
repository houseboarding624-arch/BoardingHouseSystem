const CX = 60;
const CY = 60;
const R = 52;

function arcPath(start, end) {
  const point = (angle) => [CX + R * Math.cos(angle), CY + R * Math.sin(angle)];
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
}

/**
 * Plain-SVG pie chart with a legend (no chart library).
 * items: [{ key, label, value, color }]   totalLabel: text for the total row.
 */
export default function PieChart({ items, totalLabel = 'Total' }) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const visible = items.filter((i) => i.value > 0);

  let angle = -Math.PI / 2; // start at 12 o'clock
  const paths = visible.map((item) => {
    const sweep = (item.value / total) * Math.PI * 2;
    const start = angle;
    angle += sweep;
    return { ...item, start, end: angle };
  });

  return (
    <div className="pie-wrap">
      <svg
        viewBox="0 0 120 120"
        className="pie-svg"
        role="img"
        aria-label={items.map((i) => `${i.value} ${i.label}`).join(', ')}
      >
        {total === 0 && <circle cx={CX} cy={CY} r={R} fill="#e2e8f0" />}
        {paths.length === 1 && <circle cx={CX} cy={CY} r={R} fill={paths[0].color} />}
        {paths.length > 1 &&
          paths.map((p) => (
            <path key={p.key} d={arcPath(p.start, p.end)} fill={p.color} stroke="#ffffff" strokeWidth="1" />
          ))}
      </svg>

      <ul className="pie-legend">
        {items.map((i) => (
          <li key={i.key}>
            <span className="pie-dot" style={{ background: i.color }} />
            <span>{i.label}</span>
            <strong>
              {i.value}
              {total > 0 && <small> ({Math.round((i.value / total) * 100)}%)</small>}
            </strong>
          </li>
        ))}
        <li className="pie-total">
          <span>{totalLabel}</span>
          <strong>{total}</strong>
        </li>
      </ul>
    </div>
  );
}
