// Works with the `pagination` object the API returns: { page, limit, total, totalPages }
import { ChevronLeft, ChevronRight } from 'lucide-react';

// [1, '...', 4, 5, 6, '...', 10]
export function pageWindow(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => { if (i && p - sorted[i - 1] > 1) out.push('...'); out.push(p); });
  return out;
}

export default function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>Showing {from}-{to} of {total}</span>
      {totalPages > 1 && (
        <div className="pager">
          <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
          {pageWindow(page, totalPages).map((p, i) => p === '...'
            ? <span key={`gap${i}`} aria-hidden="true">...</span>
            : <button type="button" key={p} className={p === page ? 'current' : ''} aria-current={p === page ? 'page' : undefined} onClick={() => onPageChange(p)}>{p}</button>)}
          <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
      )}
    </nav>
  );
}
