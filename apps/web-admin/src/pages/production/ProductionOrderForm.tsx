import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductionOrderForm({ onClose, onSuccess }: Props) {
  const [locations, setLocations] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    locationId: '',
    variantId: '',
    recipeVersionId: '',
    targetQuantity: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest('/masters/branches').then(r => setLocations(r.items || r)),
      apiRequest('/masters/variants').then(r => setVariants(r.items || r)),
      apiRequest('/masters/recipes').then(r => setRecipes(r.items || r))
    ]).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiRequest('/production/orders', 'POST', {
        ...formData,
        targetQuantity: Number(formData.targetQuantity)
      });
      if (res) onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to create production order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '30px', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: '24px' }}>
          ✕
        </button>

        <h2 style={{ marginBottom: '24px', fontWeight: 600 }}>New Production Order</h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Location (Factory)</label>
            <select
              required
              className="form-input"
              value={formData.locationId}
              onChange={e => setFormData({...formData, locationId: e.target.value})}
            >
              <option value="">Select Location</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Finished Good (Variant)</label>
            <select
              required
              className="form-input"
              value={formData.variantId}
              onChange={e => setFormData({...formData, variantId: e.target.value})}
            >
              <option value="">Select Variant</option>
              {variants.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.sku})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Recipe Version</label>
            <select
              required
              className="form-input"
              value={formData.recipeVersionId}
              onChange={e => setFormData({...formData, recipeVersionId: e.target.value})}
            >
              <option value="">Select Recipe Version</option>
              {recipes.flatMap(r => r.versions.map((v: any) => (
                <option key={v.id} value={v.id}>{r.name} - Version {v.versionNumber}</option>
              )))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Target Yield</label>
            <input
              type="number"
              step="0.01"
              required
              className="form-input"
              value={formData.targetQuantity}
              onChange={e => setFormData({...formData, targetQuantity: e.target.value})}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '14px' }}>Notes (Optional)</label>
            <textarea
              className="form-input"
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
