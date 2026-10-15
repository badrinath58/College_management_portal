// Month view of the academic calendar. Shows events as coloured chips; click one to see its details.
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';
import { buildMonthGrid, eventsOnDay, monthLabel, toISO } from '../utils/calendar';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ year, month, events, onPrev, onNext, onToday, onEventClick }) {
  const weeks = buildMonthGrid(year, month);
  const now = new Date();
  const today = toISO(now.getFullYear(), now.getMonth(), now.getDate());
  return (
    <div>
      <div className="cal-head">
        <Button variant="secondary" size="sm" onClick={onToday}>Today</Button>
        <div className="row">
          <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous month"><ChevronLeft /></button>
          <h2 aria-live="polite">{monthLabel(year, month)}</h2>
          <button type="button" className="icon-btn" onClick={onNext} aria-label="Next month"><ChevronRight /></button>
        </div>
        <span style={{ width: 70 }} />
      </div>
      <div className="cal-grid" role="grid" aria-label={monthLabel(year, month)}>
        {DOW.map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {weeks.flat().map((cell, i) => (cell === null
          ? <div key={`e${i}`} className="cal-cell empty" />
          : (
            <div key={cell.date} className={`cal-cell ${cell.date === today ? 'today' : ''}`} role="gridcell">
              <span className="num">{cell.day}</span>
              {eventsOnDay(events, cell.date).map((ev) => (
                <button type="button" key={ev.id} className={`cal-event ${ev.event_type}`} title={ev.title} onClick={() => onEventClick(ev)}>{ev.title}</button>
              ))}
            </div>
          )))}
      </div>
    </div>
  );
}
