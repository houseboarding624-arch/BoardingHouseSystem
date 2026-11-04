import { useState } from 'react';
import { api } from '../../api.js';
import ReceiptModal from '../../components/ReceiptModal.jsx';
import { peso } from '../../utils.js';
import { Badge, Btn, Card, Field, Input, Select, Table, billingText, billingToneOf, downloadCsv, dueDateStyle, dueRowClass } from './ui.jsx';

export function BillingView({ data, run }) {
  // Closest due date first, so overdue / due-this-week boarders are at the top.
  const active = data.boarders
    .filter((b) => b.status !== 'Disabled')
    .sort((a, b) => (a.billing.daysUntilDue ?? 99999) - (b.billing.daysUntilDue ?? 99999));
  const urgentCount = active.filter((b) => b.billing.urgent).length;
  const rateOf = (room) => Number(data.rooms.find((r) => r.room_number === room)?.monthly_rate ?? 0);

  async function recordRent(b) {
    const amount = rateOf(b.preferred_room);
    if (!amount) {
      window.alert('This boarder has no room rate. Use Payments to record a custom amount.');
      return;
    }
    if (window.confirm(`Record ${peso(amount)} rent paid today by ${b.full_name}?`)) {
      await run(() =>
        api.post('/payments', {
          user_id: b.id,
          amount,
          payment_date: data.today,
          type: 'Rent',
          description: 'Monthly rent',
        })
      );
    }
  }

  return (
    <Card title="Billing">
      <p className="ov-hint" style={{ marginTop: 0 }}>
        <b style={{ color: urgentCount ? '#dc2626' : undefined }}>{urgentCount}</b> tenant(s) overdue or due within 7 days
        are shown in <b style={{ color: '#dc2626' }}>red</b>. Paying rent moves the due date a month ahead.
      </p>
      <Table head={['Tenant', 'Room', 'Rent', 'Next due', 'Status', 'Actions']} empty="No active tenants.">
        {active.map((b) => (
          <tr key={b.id} className={dueRowClass(b.billing, b.status)}>
            <td>{b.full_name}</td>
            <td>{b.preferred_room || '-'}</td>
            <td>{rateOf(b.preferred_room) ? peso(rateOf(b.preferred_room)) : '-'}</td>
            <td style={dueDateStyle(b.billing)}>{b.next_due_date || 'Not set'}</td>
            <td>
              <Badge tone={billingToneOf(b.billing)}>{billingText(b.billing)}</Badge>
              {b.billing.deadline && ['Overdue', 'Past grace'].includes(b.billing.state) && (
                <div className="property-sub">Disabled after {b.billing.deadline}</div>
              )}
            </td>
            <td className="ov-actions">
              <Btn small onClick={() => recordRent(b)}>
                Record rent
              </Btn>
              <Btn small tone="ghost" onClick={() => run(() => api.post(`/owner/tenants/${b.id}/remind`))}>
                Remind
              </Btn>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

function PaymentForm({ data, run, fixedType }) {
  const blank = {
    user_id: '',
    amount: '',
    payment_date: data.today,
    type: fixedType ?? 'Rent',
    description: '',
    proof_ref: '',
  };
  const [form, setForm] = useState(blank);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const active = data.boarders.filter((b) => b.status !== 'Disabled');

  return (
    <Card title={fixedType ? `Record ${fixedType}` : 'Record Payment'}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api.post('/payments', form))) setForm(blank);
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '9px', alignItems: 'end' }}
      >
        <Field label="BOARDER">
          <Select value={form.user_id} onChange={set('user_id')} required>
            <option value="">Select…</option>
            {active.map((b) => (
              <option key={b.id} value={b.id}>
                {b.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="AMOUNT">
          <Input type="number" min="1" step="0.01" value={form.amount} onChange={set('amount')} required />
        </Field>
        <Field label="DATE">
          <Input type="date" value={form.payment_date} onChange={set('payment_date')} required />
        </Field>
        {!fixedType && (
          <Field label="TYPE">
            <Select value={form.type} onChange={set('type')}>
              <option>Rent</option>
              <option>Advance Payment</option>
              <option>Other</option>
            </Select>
          </Field>
        )}
        <Field label="DESCRIPTION">
          <Input value={form.description} onChange={set('description')} maxLength={255} />
        </Field>
        <Field label="PROOF / REFERENCE NO. (optional)">
          <Input value={form.proof_ref} onChange={set('proof_ref')} maxLength={255} placeholder="GCash ref, receipt no., link…" />
        </Field>
        <Btn type="submit">Save</Btn>
      </form>
      {!fixedType && (
        <p className="ov-hint">
          A Rent payment moves the boarder's next due date one month ahead. Rent can be recorded once per month per
          boarder; use Advance Payment to pay ahead. Recorded payments are marked Paid automatically.
        </p>
      )}
    </Card>
  );
}

const typeTone = { Rent: 'green', 'Advance Payment': 'blue', Other: 'gray' };

export function PaymentsView({ data, run }) {
  const [receiptId, setReceiptId] = useState(null);
  return (
    <>
      <PaymentForm data={data} run={run} />
      <Card title={`Payments (${data.payments.length})`}>
        <Table head={['Date', 'Boarder', 'Type', 'Amount', 'Description', 'Receipt']} empty="No payments recorded yet.">
          {data.payments.map((p) => (
            <tr key={p.id}>
              <td>{p.payment_date}</td>
              <td>{p.full_name}</td>
              <td>
                <Badge tone={typeTone[p.type]}>{p.type}</Badge>
              </td>
              <td>{peso(p.amount)}</td>
              <td>{p.description || '-'}</td>
              <td>
                {p.verified ? (
                  <Btn small tone="ghost" onClick={() => setReceiptId(p.id)}>
                    Receipt
                  </Btn>
                ) : (
                  <span style={{ color: '#64748b' }}>Unpaid</span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  );
}

export function AdvancePaymentsView({ data, run }) {
  const advances = data.payments.filter((p) => p.type === 'Advance Payment');
  const total = advances.reduce((sum, p) => sum + Number(p.amount), 0);
  return (
    <>
      <PaymentForm data={data} run={run} fixedType="Advance Payment" />
      <Card title={`Advance Payments - ${peso(total)} received`}>
        <Table head={['Date', 'Boarder', 'Amount', 'Description']} empty="No advance payments recorded yet.">
          {advances.map((p) => (
            <tr key={p.id}>
              <td>{p.payment_date}</td>
              <td>{p.full_name}</td>
              <td>{peso(p.amount)}</td>
              <td>{p.description || '-'}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

export function ProofsView({ data, run }) {
  const [filter, setFilter] = useState('All');
  const [receiptId, setReceiptId] = useState(null);
  const list = data.payments.filter((p) =>
    filter === 'Unpaid' ? !p.verified : filter === 'Paid' ? p.verified : true
  );
  return (
    <Card
      title="Payment Proofs"
      action={
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto', marginTop: 0 }}>
          <option>All</option>
          <option>Unpaid</option>
          <option>Paid</option>
        </Select>
      }
    >
      <Table head={['Date', 'Boarder', 'Amount', 'Proof / reference', 'Status', 'Actions']} empty="No payments.">
        {list.map((p) => (
          <tr key={p.id}>
            <td>{p.payment_date}</td>
            <td>{p.full_name}</td>
            <td>{peso(p.amount)}</td>
            <td>{p.proof_ref || <span style={{ color: '#64748b' }}>none</span>}</td>
            <td>{p.verified ? <Badge tone="green">Paid</Badge> : <Badge tone="red">Unpaid</Badge>}</td>
            <td className="ov-actions">
              <Btn
                small
                tone="ghost"
                onClick={() => {
                  const value = window.prompt('Proof / reference number or link', p.proof_ref ?? '');
                  if (value !== null) run(() => api.patch(`/owner/payments/${p.id}`, { proof_ref: value }));
                }}
              >
                Edit proof
              </Btn>
              {p.verified && (
                <Btn small tone="ghost" onClick={() => setReceiptId(p.id)}>
                  Receipt
                </Btn>
              )}
              <Btn small onClick={() => run(() => api.patch(`/owner/payments/${p.id}`, { verified: !p.verified }))}>
                {p.verified ? 'Mark Unpaid' : 'Mark Paid'}
              </Btn>
            </td>
          </tr>
        ))}
      </Table>
      {receiptId && <ReceiptModal paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </Card>
  );
}

export function ExpensesView({ data, run }) {
  const blank = { category: '', amount: '', expense_date: data.today, description: '' };
  const [form, setForm] = useState(blank);
  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const total = data.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <>
      <Card title="Add Expense">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.post('/owner/expenses', form))) setForm(blank);
          }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '9px', alignItems: 'end' }}
        >
          <Field label="CATEGORY">
            <Input value={form.category} onChange={set('category')} placeholder="Electricity, Water, Repairs…" required />
          </Field>
          <Field label="AMOUNT">
            <Input type="number" min="1" step="0.01" value={form.amount} onChange={set('amount')} required />
          </Field>
          <Field label="DATE">
            <Input type="date" value={form.expense_date} onChange={set('expense_date')} required />
          </Field>
          <Field label="DESCRIPTION">
            <Input value={form.description} onChange={set('description')} maxLength={255} />
          </Field>
          <Btn type="submit">Save</Btn>
        </form>
      </Card>
      <Card title={`Expenses - ${peso(total)} total`}>
        <Table head={['Date', 'Category', 'Description', 'Amount', '']} empty="No expenses yet.">
          {data.expenses.map((e) => (
            <tr key={e.id}>
              <td>{e.expense_date}</td>
              <td>{e.category}</td>
              <td>{e.description || '-'}</td>
              <td>{peso(e.amount)}</td>
              <td>
                <Btn small tone="danger" onClick={() => window.confirm('Delete this expense?') && run(() => api.del(`/owner/expenses/${e.id}`))}>
                  Delete
                </Btn>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}

export function ReportsView({ data }) {
  const totals = data.report.reduce(
    (t, r) => ({ income: t.income + r.income, expenses: t.expenses + r.expenses, net: t.net + r.net }),
    { income: 0, expenses: 0, net: 0 }
  );
  const s = data.stats;
  return (
    <>
      <Card
        title="Income vs Expenses (last 6 months)"
        action={
          <div className="ov-actions">
            <Btn
              small
              tone="ghost"
              onClick={() =>
                downloadCsv('report.csv', [
                  ['Month', 'Income', 'Expenses', 'Net'],
                  ...data.report.map((r) => [r.month, r.income, r.expenses, r.net]),
                ])
              }
            >
              Download CSV
            </Btn>
            <Btn small tone="ghost" onClick={() => window.print()}>
              Print
            </Btn>
          </div>
        }
      >
        <Table head={['Month', 'Income', 'Expenses', 'Net']}>
          {data.report.map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              <td>{peso(r.income)}</td>
              <td>{peso(r.expenses)}</td>
              <td style={{ color: r.net < 0 ? '#dc2626' : '#059669' }}>{peso(r.net)}</td>
            </tr>
          ))}
          <tr>
            <td>
              <b>Total</b>
            </td>
            <td>
              <b>{peso(totals.income)}</b>
            </td>
            <td>
              <b>{peso(totals.expenses)}</b>
            </td>
            <td>
              <b>{peso(totals.net)}</b>
            </td>
          </tr>
        </Table>
      </Card>
      <Card title="Snapshot">
        <div className="ov-snapshot">
          <div><span>Rooms</span><b>{s.totalRooms}</b></div>
          <div><span>Occupied rooms</span><b>{s.occupiedRooms}/{s.totalRooms}</b></div>
          <div><span>Occupancy</span><b>{s.occupancyRate}%</b></div>
          <div><span>Active tenants</span><b>{s.tenants}</b></div>
          <div><span>Overdue tenants</span><b>{s.overdue}</b></div>
          <div><span>Disabled</span><b>{s.disabled}</b></div>
        </div>
      </Card>
    </>
  );
}
