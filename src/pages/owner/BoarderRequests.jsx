import { useState } from 'react';
import { api } from '../../api.js';
import { dateTime, peso } from '../../utils.js';
import { Badge, Btn, Card, Select, Table } from './ui.jsx';

const reportTone = { New: 'red', 'In Progress': 'orange', Resolved: 'green' };
const gcashTone = { Pending: 'orange', Approved: 'green', Rejected: 'red' };

export function BoarderReportsView({ data, run }) {
  const [filter, setFilter] = useState('All');
  const list = data.reports.filter((r) => filter === 'All' || r.status === filter);

  return (
    <Card
      title={`Boarder Reports (${data.stats.newReports} new)`}
      action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
          <option>All</option>
          <option>New</option>
          <option>In Progress</option>
          <option>Resolved</option>
        </Select>
      }
    >
      <Table head={['When', 'Boarder', 'Report', 'Status', 'Actions']} empty="No reports.">
        {list.map((r) => (
          <tr key={r.id}>
            <td>{dateTime(r.created_at)}</td>
            <td>
              {r.full_name}
              <div className="property-sub">Room {r.room || '-'}</div>
            </td>
            <td style={{ maxWidth: 360 }}>
              <b>{r.subject}</b> <Badge tone="blue">{r.category}</Badge>
              <div>{r.message}</div>
              {r.admin_reply && <div className="property-sub">Your reply: {r.admin_reply}</div>}
            </td>
            <td>
              <Badge tone={reportTone[r.status]}>{r.status}</Badge>
            </td>
            <td className="ov-actions">
              <Btn
                small
                tone="ghost"
                onClick={() => {
                  const reply = window.prompt('Reply to the boarder', r.admin_reply ?? '');
                  if (reply) {
                    run(() =>
                      api.patch(`/owner/reports/${r.id}`, {
                        reply,
                        status: r.status === 'New' ? 'In Progress' : r.status,
                      })
                    );
                  }
                }}
              >
                Reply
              </Btn>
              {r.status !== 'In Progress' && r.status !== 'Resolved' && (
                <Btn small tone="ghost" onClick={() => run(() => api.patch(`/owner/reports/${r.id}`, { status: 'In Progress' }))}>
                  In progress
                </Btn>
              )}
              {r.status !== 'Resolved' && (
                <Btn small onClick={() => run(() => api.patch(`/owner/reports/${r.id}`, { status: 'Resolved' }))}>
                  Resolve
                </Btn>
              )}
            </td>
          </tr>
        ))}
      </Table>
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
