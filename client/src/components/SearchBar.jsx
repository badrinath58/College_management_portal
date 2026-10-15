// Controlled search box with a clear (x) button. useList() waits for typing to stop before calling the API.
import { Search, X } from 'lucide-react';

export default function SearchBar({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="search-bar" role="search">
      <Search size={17} className="search-icon" aria-hidden="true" />
      <input type="search" className="control" value={value} placeholder={placeholder} aria-label={placeholder}
        onChange={(e) => onChange(e.target.value)} />
      {value && <button type="button" className="clear-btn" onClick={() => onChange('')} aria-label="Clear search"><X size={15} /></button>}
    </div>
  );
}
