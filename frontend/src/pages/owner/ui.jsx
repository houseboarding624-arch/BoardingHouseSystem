export const labelStyle = { color: '#64748b', fontSize: '13px', fontWeight: 800 };
export const fieldStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  marginTop: '6px',
  padding: '9px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  background: '#f1f5f9',
  color: '#0f172a',
  fontSize: '15px',
};

export function Field({ label, children }) {
  return (
    <label style={labelStyle}>
      {label}
      {children}
    </label>
  );
}

export const Input = (props) => <input style={fieldStyle} {...props} />;
export const Select = (props) => <select style={fieldStyle} {...props} />;

export function Btn({ tone = 'primary', small, ...props }) {
  return <button type="button" className={`ov-btn ${tone} ${small ? 'small' : ''}`} {...props} />;
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`ov-badge ${tone}`}>{children}</span>;
}

export function Card({ title, action, children, id }) {
  return (
    <section className="owner-card" id={id} style={{ marginBottom: '12px' }}>
      <div className="owner-card-pad">
        <div className="owner-card-title">
          <h2>{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

export function Table({ head, children, empty, colSpan }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;
  return (
    <div className="table-wrap">
      <table className="property-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {isEmpty && (
            <tr>
              <td colSpan={colSpan ?? head.length} style={{ color: '#64748b' }}>
                {empty ?? 'Nothing here yet.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export const roomTone = { Available: 'green', Occupied: 'red', Maintenance: 'orange' };
export const billingTone = {
  Upcoming: 'gray',
  'Due soon': 'orange',
  Overdue: 'red',
  'Past grace': 'red',
  Disabled: 'red',
  'No due date': 'gray',
};

// Red = unpaid and overdue, or due within 7 days (the backend sets `urgent`).
export const billingToneOf = (b) => (b.urgent ? 'red' : billingTone[b.state]);
export const dueDateStyle = (b) => (b?.urgent ? { color: '#dc2626', fontWeight: 800 } : undefined);
export const dueRowClass = (b, status) => (status !== 'Disabled' && b?.urgent ? 'due-urgent' : undefined);

export function billingText(b) {
  if (b.state === 'Overdue' || b.state === 'Past grace') {
    return b.daysUntilDue === 0 ? 'Due today' : `Overdue ${-b.daysUntilDue}d`;
  }
  if (b.state === 'Due soon' || b.state === 'Upcoming') return `Due in ${b.daysUntilDue}d`;
  return b.state;
}

export function downloadCsv(filename, rows) {
  const escape = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
