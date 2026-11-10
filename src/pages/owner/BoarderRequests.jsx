import { useState } from 'react';
import { api } from '../../api.js';
import { dateTime, peso } from '../../utils.js';
import { Badge, Btn, Card, Select, Table } from './ui.jsx';

const reportTone = { New: 'red', 'In Progress': 'orange', Resolved: 'green' };
const gcashTone = { Pending: 'orange', Approved: 'green', Rejected: 'red' };

const STATUS_ORDER = { New: 0, 'In Progress': 1, Resolved: 2 };
const STATUS_CLASS = { New: 'new', 'In Progress': 'progress', Resolved: 'done' };

/** One report as a card: who sent it, what they said, your reply, and the actions. */
function ReportItem({ r, run }) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState(r.admin_reply ?? '');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const reply = text.trim();
    if (!reply) return;
    setBusy(true);
    await run(() =>
      api.patch(`/owner/reports/${r.id}`, { reply, status: r.status === 'New' ? 'In Progress' : r.status })
    );
    setBusy(false);
    setReplying(false);
  };

  return (
    <article className={`rp-card ${STATUS_CLASS[r.status] ?? ''}`}>
      <header className="rp-head">
        <div className="rp-who">
          <span className="rp-avatar">{(r.full_name || '?').trim().charAt(0).toUpperCase()}</span>
          <div>
            <b>{r.full_name}</b>
            <div className="property-sub">
              Room {r.room || '-'} · {dateTime(r.created_at)}
            </div>
          </div>
        </div>
        <Badge tone={reportTone[r.status]}>{r.status}</Badge>
      </header>

      <div className="rp-subject">
        <h3>{r.subject}</h3>
        <Badge tone="blue">{r.category}</Badge>
      </div>
      <p className="rp-message">{r.message}</p>

      {r.admin_reply && !replying && (
        <div className="rp-reply">
          <span>YOUR REPLY</span>
          <p>{r.admin_reply}</p>
        </div>
      )}

      {replying && (
        <div className="rp-reply-form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Type your reply to the boarder..."
            autoFocus
          />
          <div className="rp-actions">
            <Btn small disabled={busy || !text.trim()} onClick={send}>
              Send reply
            </Btn>
            <Btn small tone="ghost" onClick={() => setReplying(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {!replying && (
        <footer className="rp-actions">
          <Btn small tone="ghost" onClick={() => setReplying(true)}>
            {r.admin_reply ? 'Edit reply' : 'Reply'}
          </Btn>
          {r.status === 'New' && (
            <Btn small tone="ghost" onClick={() => run(() => api.patch(`/owner/reports/${r.id}`, { status: 'In Progress' }))}>
              Mark in progress
            </Btn>
          )}
          {r.status !== 'Resolved' && (
            <Btn small onClick={() => run(() => api.patch(`/owner/reports/${r.id}`, { status: 'Resolved' }))}>
              Resolve
            </Btn>
          )}
        </footer>
      )}
    </article>
  );
}

export function BoarderReportsView({ data, run }) {
  const [filter, setFilter] = useState('All');
  const all = data.reports ?? [];
  const count = (status) => (status === 'All' ? all.length : all.filter((r) => r.status === status).length);
  // Open reports first (New, then In Progress, then Resolved); newest first inside each group.
  const list = all
    .filter((r) => filter === 'All' || r.status === filter)
    .sort(
      (a, b) =>
        (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) ||
        new Date(b.created_at) - new Date(a.created_at)
    );

  return (
    <Card title={`Boarder Reports (${data.stats.newReports} new)`}>
      <div className="rp-tabs">
        {['All', 'New', 'In Progress', 'Resolved'].map((s) => (
          <button key={s} type="button" className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s} <span>{count(s)}</span>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="ov-hint">No reports here.</p>
      ) : (
        <div className="rp-list">
          {list.map((r) => (
            <ReportItem key={r.id} r={r} run={run} />
          ))}
        </div>
      )}
    </Card>
  );
}

export function GcashView({ data, run }) {
  const [filter, setFilter] = useState('Pending');
  const list = data.gcashPayments.filter((g) => filter === 'All' || g.status === filter);

  return (
    <Card
      title={`GCash Payments (${data.stats.pendingGcash} pending)`}
      action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>All</option>
        </Select>
      }
    >
      <p className="ov-hint" style={{ marginTop: 0 }}>
        Check the Reference No. against your GCash transaction history, then approve. Approving records the payment
        (and moves the due date one month ahead for Rent).
      </p>
      <Table head={['Sent', 'Boarder', 'Amount', 'For', 'Reference', 'From', 'Status', 'Actions']} empty="Nothing here.">
        {list.map((g) => (
          <tr key={g.id}>
            <td>{dateTime(g.created_at)}</td>
            <td>{g.full_name}</td>
            <td>{peso(g.amount)}</td>
            <td>
              {g.type}
              {g.note && <div className="property-sub">{g.note}</div>}
            </td>
            <td>
              <b>{g.reference_no}</b>
            </td>
            <td>{g.sender_number || '-'}</td>
            <td>
              <Badge tone={gcashTone[g.status]}>{g.status}</Badge>
              {g.reject_reason && <div className="property-sub">{g.reject_reason}</div>}
            </td>
            <td className="ov-actions">
              {g.status === 'Pending' && (
                <>
                  <Btn
                    small
                    onClick={() =>
                      window.confirm(`Approve ${peso(g.amount)} from ${g.full_name}?`) &&
                      run(() => api.post(`/owner/gcash/${g.id}/approve`))
                    }
                  >
                    Approve
                  </Btn>
                  <Btn
                    small
                    tone="ghost"
                    onClick={() => {
                      const reason = window.prompt('Reason for rejecting (the boarder will see this)');
                      if (reason) run(() => api.post(`/owner/gcash/${g.id}/reject`, { reason }));
                    }}
                  >
                    Reject
                  </Btn>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
