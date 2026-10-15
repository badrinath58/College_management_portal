// Weekly timetable. Desktop: a grid (time x day). Phone: one card per day.
// Each cell shows subject, faculty, room, start and end time. slots = the list the API returns.
import { formatTime } from '../utils/format';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Cell({ slot }) {
  return (
    <div className="tt-cell">
      <strong>{slot.subject_name}</strong>
      <small>{slot.subject_code}{slot.faculty_name ? ` | ${slot.faculty_name}` : ''}</small>
      <small>Room {slot.room_number} | {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</small>
      {slot.section && <small>Section {slot.section}</small>}
    </div>
  );
}

export default function Timetable({ slots }) {
  const periods = [...new Set(slots.map((s) => `${s.start_time}|${s.end_time}`))].sort();
  const at = (day, period) => slots.filter((s) => s.day_of_week === day && `${s.start_time}|${s.end_time}` === period);
  return (
    <div className="timetable">
      <div className="tt-grid table-wrap">
        <table>
          <thead><tr><th className="time">Time</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            {periods.map((p) => {
              const [start, end] = p.split('|');
              return (
                <tr key={p}>
                  <td className="time">{formatTime(start)}<br />{formatTime(end)}</td>
                  {DAYS.map((d) => <td key={d}>{at(d, p).map((s) => <Cell key={s.id} slot={s} />)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tt-days">
        {DAYS.map((d) => {
          const list = slots.filter((s) => s.day_of_week === d);
          return list.length === 0 ? null : (
            <div className="tt-day" key={d}><h4>{d}</h4>{list.map((s) => <Cell key={s.id} slot={s} />)}</div>
          );
        })}
      </div>
    </div>
  );
}
