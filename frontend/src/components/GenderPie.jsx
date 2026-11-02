import PieChart from './PieChart.jsx';

/** Male / Female count of the current (not disabled) boarders. */
export default function GenderPie({ boarders }) {
  const active = (boarders ?? []).filter((b) => b.status !== 'Disabled');
  const count = (gender) => active.filter((b) => b.gender === gender).length;
  const known = count('Male') + count('Female');
  const items = [
    { key: 'male', label: 'Male', value: count('Male'), color: '#3b82f6' },
    { key: 'female', label: 'Female', value: count('Female'), color: '#ec4899' },
  ];
  // Older accounts created before the gender field existed.
  if (active.length > known) items.push({ key: 'unset', label: 'Not set', value: active.length - known, color: '#64748b' });

  return <PieChart totalLabel="Total boarders" items={items} />;
}
