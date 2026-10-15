// One component for "list + search + filters + add + edit + delete" pages.
// You describe the page (url, columns, fields) and this draws it. Used by departments, courses, books, rooms, lesson plans...
//
//   <CrudManager title="Departments" url="/departments" entity="department"
//     columns={[{ key: 'name', header: 'Name' }]} fields={[{ name: 'name', label: 'Name', required: true }]} />
import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from './PageHeader';
import SearchBar from './SearchBar';
import Select from './Select';
import Button from './Button';
import DataTable from './DataTable';
import Pagination from './Pagination';
import ConfirmDialog from './ConfirmDialog';
import FormModal from './FormModal';
import useList from '../hooks/useList';
import useOptions from '../hooks/useOptions';
import { useToast } from '../hooks/useToast';
import { http } from '../services/api';

export default function CrudManager({
  title, subtitle, url, entity = 'record', columns, fields, filters = [], searchPlaceholder, limit = 10, embedded = false,
  canCreate = true, canEdit = true, canDelete = true, deleteLabel = 'Delete', loadOne = false, rowActions, headerActions,
  confirmDeleteText, listParams, defaults = {},
}) {
  const toast = useToast();
  const list = useList(url, { limit, params: listParams });
  const filterOptions = useOptions(filters, true);
  const [form, setForm] = useState(null);       // null = closed, else { mode: 'create'|'edit', row }
  const [target, setTarget] = useState(null);   // row waiting for delete confirmation

  async function openEdit(row) {
    if (!loadOne) return setForm({ mode: 'edit', row });
    try { const body = await http.get(`${url}/${row.id}`); setForm({ mode: 'edit', row: body.data }); } catch (err) { toast.error(err.message); }
  }

  async function save(values) {
    const res = form.mode === 'edit' ? await http.put(`${url}/${form.row.id}`, values) : await http.post(url, values);
    toast.success(res.message);
    setForm(null);
    list.reload();
  }

  async function remove() {
    try { const res = await http.delete(`${url}/${target.id}`); toast.success(res.message); list.reload(); }
    catch (err) { toast.error(err.message); } finally { setTarget(null); }
  }

  const allColumns = [...columns, ...((canEdit || canDelete || rowActions) ? [{
    key: '_actions', header: '',
    render: (row) => (
      <span className="actions-cell">
        {rowActions && rowActions(row, list.reload)}
        {canEdit && <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => openEdit(row)}>Edit</Button>}
        {canDelete && <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setTarget(row)}>{deleteLabel}</Button>}
      </span>),
  }] : [])];

  const card = (
    <div className="card">
      <div className="toolbar">
        {searchPlaceholder && <SearchBar value={list.search} onChange={list.setSearch} placeholder={searchPlaceholder} />}
        {filters.map((f) => (
          <Select key={f.name} label={f.label} placeholder="All" value={list.filters[f.name] || ''} onChange={(e) => list.setFilter(f.name, e.target.value)} options={f.options || filterOptions[f.name] || []} />
        ))}
        {embedded && canCreate && <><span className="spacer" /><Button icon={<Plus size={17} />} onClick={() => setForm({ mode: 'create', row: defaults })}>Add {entity}</Button></>}
      </div>
      <DataTable columns={allColumns} rows={list.items} loading={list.loading} error={list.error} onRetry={list.reload} emptyTitle={`No ${entity}s found`} emptyMessage="Use the Add button to create the first one." />
      <Pagination pagination={list.pagination} onPageChange={list.setPage} />
    </div>
  );

  return (
    <>
      {!embedded && <PageHeader title={title} subtitle={subtitle} actions={<>{headerActions}{canCreate && <Button icon={<Plus size={17} />} onClick={() => setForm({ mode: 'create', row: defaults })}>Add {entity}</Button>}</>} />}
      {card}
      <FormModal open={Boolean(form)} mode={form?.mode} title={form?.mode === 'edit' ? `Edit ${entity}` : `Add ${entity}`} fields={fields} initial={form?.row || {}}
        onSubmit={save} onClose={() => setForm(null)} />
      <ConfirmDialog open={Boolean(target)} danger title={`${deleteLabel} this ${entity}?`} confirmText={deleteLabel} onConfirm={remove} onCancel={() => setTarget(null)}
        message={confirmDeleteText ? confirmDeleteText(target) : `This ${entity} will be ${deleteLabel === 'Delete' ? 'deleted permanently' : 'disabled'}.`} />
    </>
  );
}
