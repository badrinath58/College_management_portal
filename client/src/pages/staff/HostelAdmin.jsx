// Admin hostel management: booking requests (approve / reject), occupancy, rooms and hostels.
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import Tabs from '../../components/Tabs';
import Select from '../../components/Select';
import SearchBar from '../../components/SearchBar';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import FormModal from '../../components/FormModal';
import ConfirmDialog from '../../components/ConfirmDialog';
import CrudManager from '../../components/CrudManager';
import ProgressBar from '../../components/ProgressBar';
import DashboardCard from '../../components/DashboardCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import useList from '../../hooks/useList';
import useFetch from '../../hooks/useFetch';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { BedDouble } from 'lucide-react';
import { formatCurrency, formatDateTime, formatPercent, humanize } from '../../utils/format';

const ROOM_FIELDS = [
  { name: 'hostel_id', label: 'Hostel', type: 'select', required: true, optionsUrl: '/hostel/hostels', optionsParams: { limit: 100 }, optionLabel: (h) => `${h.name} (Block ${h.block})` },
  { name: 'room_number', label: 'Room number', required: true, maxLength: 10 },
  { name: 'floor_no', label: 'Floor', type: 'number', required: true, min: 0 },
  { name: 'room_type', label: 'Room type', type: 'select', required: true, options: ['single', 'double', 'triple', 'dormitory'].map((v) => ({ value: v, label: humanize(v) })) },
  { name: 'capacity', label: 'Capacity (beds)', type: 'number', required: true, min: 1 },
  { name: 'occupied_beds', label: 'Occupied beds', type: 'number', min: 0, hint: 'Beds taken by students who are not in this system' },
  { name: 'annual_fee', label: 'Annual fee (Rs.)', type: 'number', required: true, min: 0 },
];
const HOSTEL_FIELDS = [
  { name: 'name', label: 'Hostel name', required: true }, { name: 'block', label: 'Block', required: true, maxLength: 10 },
  { name: 'hostel_type', label: 'For', type: 'select', required: true, options: [{ value: 'boys', label: 'Boys' }, { value: 'girls', label: 'Girls' }] },
  { name: 'warden_name', label: 'Warden name' }, { name: 'warden_phone', label: 'Warden phone' }, { name: 'total_floors', label: 'Floors', type: 'number', min: 1 },
];

function RequestsTab() {
  const toast = useToast();
  const list = useList('/hostel/bookings', { limit: 10, initialFilters: { status: 'pending' } });
  const [review, setReview] = useState(null);       // { booking, action }
  const [cancelTarget, setCancelTarget] = useState(null);

  async function submitReview(values) {
    const res = await http.put(`/hostel/bookings/${review.booking.id}/review`, { action: review.action, remarks: values.remarks || undefined });
    toast.success(res.message); setReview(null); list.reload();
  }
  async function cancel() {
    try { const res = await http.put(`/hostel/bookings/${cancelTarget.id}/cancel`); toast.success(res.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setCancelTarget(null); }
  }
  const columns = [
    { key: 'student_name', header: 'Student', render: (b) => `${b.student_name} (${b.student_code})` },
    { key: 'room_number', header: 'Room', render: (b) => `${b.room_number} - ${b.hostel_name}` },
    { key: 'room_type', header: 'Type', render: (b) => humanize(b.room_type) },
    { key: 'requested_on', header: 'Requested', render: (b) => formatDateTime(b.requested_on) },
    { key: 'status', header: 'Status', render: (b) => <Badge status={b.status} /> },
    { key: 'remarks', header: 'Remarks' },
    { key: 'id', header: '', render: (b) => (
      <span className="actions-cell">
        {b.status === 'pending' && <><Button size="sm" icon={<Check size={14} />} onClick={() => setReview({ booking: b, action: 'approve' })}>Approve</Button>
          <Button size="sm" variant="danger" icon={<X size={14} />} onClick={() => setReview({ booking: b, action: 'reject' })}>Reject</Button></>}
        {b.status === 'approved' && <Button size="sm" variant="secondary" onClick={() => setCancelTarget(b)}>Cancel allotment</Button>}
      </span>) },
  ];
  return (
    <div className="card">
      <div className="toolbar">
        <SearchBar value={list.search} onChange={list.setSearch} placeholder="Search student or room" />
        <Select label="Status" placeholder="All" value={list.filters.status || ''} onChange={(e) => list.setFilter('status', e.target.value)}
          options={['pending', 'approved', 'rejected', 'cancelled'].map((s) => ({ value: s, label: humanize(s) }))} />
      </div>
      <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle="No requests" emptyMessage="Nothing matches this filter." />
      <Pagination pagination={list.pagination} onPageChange={list.setPage} />
      <FormModal open={Boolean(review)} title={review?.action === 'approve' ? 'Approve this request' : 'Reject this request'} submitLabel={review?.action === 'approve' ? 'Approve' : 'Reject'}
        fields={[{ name: 'remarks', label: 'Remarks (the student sees this)', type: 'textarea', full: true, required: review?.action === 'reject' }]}
        note={review ? `${review.booking.student_name} - room ${review.booking.room_number}, ${review.booking.hostel_name}` : undefined} onSubmit={submitReview} onClose={() => setReview(null)} />
      <ConfirmDialog open={Boolean(cancelTarget)} danger title="Cancel this allotment?" confirmText="Cancel allotment" cancelText="Keep it" onConfirm={cancel} onCancel={() => setCancelTarget(null)}
        message={cancelTarget ? `${cancelTarget.student_name} will lose room ${cancelTarget.room_number}; the bed becomes free.` : ''} />
    </div>
  );
}

function OccupancyTab() {
  const { data, loading, error, reload } = useFetch(() => http.get('/hostel/occupancy'), []);
  if (loading && !data) return <LoadingSpinner label="Loading occupancy..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="stack">
      <div className="grid cols-3">
        <DashboardCard title="Occupancy" value={formatPercent(data.total.occupancy_percent)} icon={BedDouble} hint={`${data.total.occupied} of ${data.total.capacity} beds`} />
      </div>
      <section className="card">
        <div className="card-header">By hostel</div>
        {data.hostels.map((h) => (
          <div className="occupancy-row" key={h.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}><span><strong>{h.name}</strong> <small className="muted">Block {h.block} | {h.rooms} rooms | {humanize(h.hostel_type)}</small></span><strong>{h.occupied}/{h.capacity} beds</strong></div>
            <ProgressBar value={h.occupancy_percent} tone={h.occupancy_percent >= 90 ? 'danger' : h.occupancy_percent >= 70 ? 'warning' : 'success'} label={`${h.name} occupancy`} />
          </div>
        ))}
      </section>
    </div>
  );
}

export default function HostelAdmin() {
  const [tab, setTab] = useState('requests');
  return (
    <>
      <PageHeader title="Hostel Management" subtitle="Approve room requests, watch occupancy, and manage rooms." />
      <Tabs tabs={[{ id: 'requests', label: 'Requests' }, { id: 'occupancy', label: 'Occupancy' }, { id: 'rooms', label: 'Rooms' }, { id: 'hostels', label: 'Hostels' }]} active={tab} onChange={setTab} />
      {tab === 'requests' && <RequestsTab />}
      {tab === 'occupancy' && <OccupancyTab />}
      {tab === 'rooms' && (
        <CrudManager embedded entity="room" url="/hostel/rooms" fields={ROOM_FIELDS} searchPlaceholder="Search room or hostel" limit={10}
          filters={[{ name: 'hostel_id', label: 'Hostel', optionsUrl: '/hostel/hostels', optionsParams: { limit: 100 }, optionLabel: (h) => h.name }]}
          columns={[{ key: 'room_number', header: 'Room', render: (r) => <strong>{r.room_number}</strong> }, { key: 'hostel_name', header: 'Hostel', render: (r) => `${r.hostel_name} (Block ${r.block})` },
            { key: 'floor_no', header: 'Floor', numeric: true }, { key: 'room_type', header: 'Type', render: (r) => humanize(r.room_type) },
            { key: 'capacity', header: 'Capacity', numeric: true }, { key: 'occupied_beds', header: 'Occupied', numeric: true },
            { key: 'available_beds', header: 'Free', numeric: true, render: (r) => <Badge tone={r.available_beds > 0 ? 'success' : 'danger'}>{r.available_beds}</Badge> },
            { key: 'annual_fee', header: 'Annual fee', numeric: true, render: (r) => formatCurrency(r.annual_fee) }]} />
      )}
      {tab === 'hostels' && (
        <CrudManager embedded entity="hostel" url="/hostel/hostels" fields={HOSTEL_FIELDS} searchPlaceholder="Search hostel"
          columns={[{ key: 'name', header: 'Name', render: (h) => <strong>{h.name}</strong> }, { key: 'block', header: 'Block' }, { key: 'hostel_type', header: 'For', render: (h) => humanize(h.hostel_type) },
            { key: 'warden_name', header: 'Warden' }, { key: 'warden_phone', header: 'Phone' }, { key: 'total_floors', header: 'Floors', numeric: true }]} />
      )}
    </>
  );
}
