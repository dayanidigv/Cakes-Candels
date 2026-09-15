import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { DataTable } from '../DataTable';

export const MasterDataPage = ({ title, endpoint, columns, FormComponent, emptyFormState, triggerAlert }: any) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState(emptyFormState);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadData = async (page = pagination.page, searchTerm = search) => {
    try {
      const res = await apiRequest(`/${endpoint}?page=${page}&limit=${pagination.limit}&search=${searchTerm}`);
      if(res && res.items) {
        setData(res.items);
        setPagination({ page: res.page, limit: res.limit, total: res.total, totalPages: res.totalPages });
      }
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await apiRequest(`/${endpoint}/${editingId}`, 'PATCH', formState);
        triggerAlert(`${title} updated successfully!`);
      } else {
        await apiRequest(`/${endpoint}`, 'POST', formState);
        triggerAlert(`${title} created successfully!`);
      }
      setFormState(emptyFormState);
      setEditingId(null);
      loadData();
    } catch (err: any) {
      triggerAlert(err.message || 'Error saving record', true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete this ${title}?`)) return;
    try {
      await apiRequest(`/${endpoint}/${id}`, 'DELETE');
      triggerAlert('Record deleted successfully!');
      loadData();
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  const handleExportCSV = () => {
    if (data.length === 0) return triggerAlert('No data to export', true);
    const keys = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const csvContent = [
      keys.join(','),
      ...data.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${endpoint}.csv`;
    a.click();
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      if (lines.length < 2) return triggerAlert('Invalid CSV file', true);
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const payload = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const obj: any = {};
        headers.forEach((h, i) => {
          if (values[i] !== undefined && values[i] !== '') {
            if (!isNaN(Number(values[i])) && h !== 'code' && h !== 'gst' && h !== 'phone') obj[h] = Number(values[i]);
            else if (values[i] === 'true' || values[i] === 'false') obj[h] = values[i] === 'true';
            else obj[h] = values[i];
          }
        });
        return obj;
      });
      try {
        const res = await apiRequest(`/${endpoint}/import`, 'POST', payload);
        triggerAlert(`Imported ${res.successCount} records. Failed: ${res.failedCount}`);
        loadData();
      } catch (err: any) {
        triggerAlert(err.message || 'Import failed', true);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{title}</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '250px' }} />
          <button onClick={handleExportCSV} className="btn-primary" style={{ background: '#3b82f6' }}>Export CSV</button>
          <label className="btn-primary" style={{ background: '#10b981', cursor: 'pointer' }}>
            Import CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportCSV} />
          </label>
        </div>
      </div>
      
      <FormComponent formState={formState} setFormState={setFormState} handleSubmit={handleSubmit} isEditing={!!editingId} setEditingId={setEditingId} emptyFormState={emptyFormState} />
      
      <DataTable 
        columns={columns} 
        data={data} 
        onEdit={(row: any) => { setEditingId(row.id); setFormState(row); }}
        onDelete={handleDelete}
        pagination={pagination}
        onPageChange={(page: number) => loadData(page)}
      />
    </div>
  );
};
