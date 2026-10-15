// One table for the whole app. Handles loading, error and empty states for you.
//   columns = [{ key: 'title', header: 'Title' }, { key: 'fee', header: 'Fee', numeric: true, render: (row) => formatCurrency(row.fee) }]
//   <DataTable columns={columns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} />
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';

export default function DataTable({ columns, rows, loading, error, onRetry, rowKey = 'id', emptyTitle = 'No records found', emptyMessage = 'Try changing the search or the filters.' }) {
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (loading && !(rows && rows.length)) return <LoadingSpinner label="Loading..." />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <div className="table-wrap" style={{ opacity: loading ? 0.6 : 1 }} aria-busy={loading || undefined}>
      <table className="table stack-mobile">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.numeric ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.header} className={c.numeric ? 'num' : ''}>
                  {c.render ? c.render(row, i) : (row[c.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
