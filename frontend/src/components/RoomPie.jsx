import PieChart from './PieChart.jsx';

/** Available / Occupied / Maintenance rooms. stats = { available, occupied, maintenance } */
export default function RoomPie({ stats }) {
  return (
    <PieChart
      totalLabel="Total rooms"
      items={[
        { key: 'available', label: 'Available', value: stats?.available ?? 0, color: '#22c55e' },
        { key: 'occupied', label: 'Occupied', value: stats?.occupied ?? 0, color: '#ef4444' },
        { key: 'maintenance', label: 'Maintenance', value: stats?.maintenance ?? 0, color: '#f59e0b' },
      ]}
    />
  );
}
