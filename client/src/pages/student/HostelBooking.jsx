// Hostel Room Booking: see the rooms for your hostel, filter them, request one, cancel your request.
import { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import Select from '../../components/Select';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Alert from '../../components/Alert';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import ConfirmDialog from '../../components/ConfirmDialog';
import LoadingSpinner from '../../components/LoadingSpinner';
import ErrorState from '../../components/ErrorState';
import EmptyState from '../../components/EmptyState';
import useFetch from '../../hooks/useFetch';
import useList from '../../hooks/useList';
import { useToast } from '../../hooks/useToast';
import { http } from '../../services/api';
import { formatCurrency, formatDateTime, humanize } from '../../utils/format';

export default function HostelBooking() {
  const toast = useToast();
  const hostels = useFetch(() => http.get('/hostel/hostels', { limit: 50 }), []);
  const bookings = useList('/hostel/bookings', { limit: 5 });
  const rooms = useList('/hostel/rooms', { limit: 6, initialFilters: { available: 'true' } });
  const [requestRoom, setRequestRoom] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);

  const active = bookings.items.find((b) => b.status === 'pending' || b.status === 'approved');

  async function sendRequest() {
    try {
      const body = await http.post('/hostel/bookings', { room_id: requestRoom.id });
      toast.success(body.message);
      bookings.reload(); rooms.reload();
    } catch (err) { toast.error(err.message); } finally { setRequestRoom(null); }
  }
  async function cancelRequest() {
    try {
      const body = await http.put(`/hostel/bookings/${cancelTarget.id}/cancel`);
      toast.success(body.message);
      bookings.reload(); rooms.reload();
    } catch (err) { toast.error(err.message); } finally { setCancelTarget(null); }
  }

  const historyColumns = [
    { key: 'room_number', header: 'Room', render: (b) => `${b.room_number} (${b.hostel_name})` },
    { key: 'room_type', header: 'Type', render: (b) => humanize(b.room_type) },
    { key: 'requested_on', header: 'Requested', render: (b) => formatDateTime(b.requested_on) },
    { key: 'status', header: 'Status', render: (b) => <Badge status={b.status} /> },
    { key: 'remarks', header: 'Remarks' },
    { key: 'id', header: '', render: (b) => (b.status === 'pending' || b.status === 'approved') && <Button size="sm" variant="danger" onClick={() => setCancelTarget(b)}>Cancel</Button> },
  ];

  return (
    <>
      <PageHeader title="Hostel Room Booking" subtitle="Request a room in your hostel. The warden approves requests." />
      <div className="stack">
        {active && (
          <Alert type={active.status === 'approved' ? 'success' : 'info'} title={active.status === 'approved' ? 'Room allotted.' : 'Request pending.'}>
            Room {active.room_number}, {active.hostel_name} ({humanize(active.room_type)}). {active.status === 'pending' ? 'Waiting for approval.' : ''}
          </Alert>
        )}

        <section className="card">
          <div className="card-header">Available rooms</div>
          <div className="toolbar">
            <Select label="Hostel / block" placeholder="All hostels" value={rooms.filters.hostel_id || ''} onChange={(e) => rooms.setFilter('hostel_id', e.target.value)}
              options={(hostels.data?.items || []).map((h) => ({ value: h.id, label: `${h.name} (Block ${h.block})` }))} />
            <Select label="Room type" placeholder="All types" value={rooms.filters.room_type || ''} onChange={(e) => rooms.setFilter('room_type', e.target.value)}
              options={['single', 'double', 'triple', 'dormitory'].map((t) => ({ value: t, label: humanize(t) }))} />
            <label className="check" style={{ paddingBottom: 10 }}>
              <input type="checkbox" checked={rooms.filters.available === 'true'} onChange={(e) => rooms.setFilter('available', e.target.checked ? 'true' : '')} /> Show only rooms with free beds
            </label>
          </div>
          {rooms.error ? <ErrorState message={rooms.error} onRetry={rooms.reload} />
            : rooms.loading && !rooms.items.length ? <LoadingSpinner label="Loading rooms..." />
            : rooms.items.length === 0 ? <EmptyState title="No rooms found" message="Try removing a filter." />
            : (
              <div className="room-grid">
                {rooms.items.map((r) => (
                  <article key={r.id} className={`room-card ${r.available_beds === 0 ? 'full' : ''}`}>
                    <div className="row"><h3>Room {r.room_number}</h3><span className="spacer" /><Badge tone={r.available_beds > 0 ? 'success' : 'danger'}>{r.available_beds > 0 ? `${r.available_beds} bed(s) free` : 'Full'}</Badge></div>
                    <small className="muted">{r.hostel_name} | Block {r.block} | Floor {r.floor_no}</small>
                    <div>{humanize(r.room_type)} | Capacity {r.capacity} | Occupied {r.occupied_beds}</div>
                    <strong>{formatCurrency(r.annual_fee)} / year</strong>
                    <Button size="sm" disabled={r.available_beds === 0 || Boolean(active)} onClick={() => setRequestRoom(r)}>
                      {active ? 'You have an active request' : 'Request room'}
                    </Button>
                  </article>
                ))}
              </div>
            )}
          <Pagination pagination={rooms.pagination} onPageChange={rooms.setPage} />
        </section>

        <section className="card">
          <div className="card-header">My requests</div>
          <DataTable columns={historyColumns} rows={bookings.items} loading={bookings.loading} error={bookings.error} onRetry={bookings.reload}
            emptyTitle="No requests yet" emptyMessage="Choose a room above to send your first request." />
          <Pagination pagination={bookings.pagination} onPageChange={bookings.setPage} />
        </section>
      </div>

      <ConfirmDialog open={Boolean(requestRoom)} title="Request this room?" confirmText="Send request" onConfirm={sendRequest} onCancel={() => setRequestRoom(null)}
        message={requestRoom ? `Room ${requestRoom.room_number} in ${requestRoom.hostel_name} (${humanize(requestRoom.room_type)}, ${formatCurrency(requestRoom.annual_fee)} per year).` : ''} />
      <ConfirmDialog open={Boolean(cancelTarget)} danger title="Cancel this request?" confirmText="Yes, cancel it" cancelText="Keep it" onConfirm={cancelRequest} onCancel={() => setCancelTarget(null)}
        message={cancelTarget ? `Your request for room ${cancelTarget.room_number} will be cancelled.` : ''} />
    </>
  );
}
