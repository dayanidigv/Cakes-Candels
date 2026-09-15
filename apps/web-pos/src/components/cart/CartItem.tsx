import React, { useState } from 'react';

interface CartItemProps {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  note?: string;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onNoteChange?: (note: string) => void;
}

export const CartItem: React.FC<CartItemProps> = ({ name, price, quantity, imageUrl, note, onIncrease, onDecrease, onRemove, onNoteChange }) => {
  const [showNote, setShowNote] = useState(!!note);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '16px 24px',
      borderBottom: '1px solid #F1F5F9',
      background: '#FFFFFF',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Product Image */}
        <div style={{
          width: '56px',
          height: '56px',
          background: imageUrl ? `url(${imageUrl}) center/cover` : '#F8FAFC',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {!imageUrl && <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '24px', opacity: 0.3 }}>cake</span>}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: '15px', color: 'var(--color-primary)', fontWeight: 800 }}>₹{price}</div>
          
          {!showNote && onNoteChange && (
            <button 
              onClick={() => setShowNote(true)} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'left', padding: 0, marginTop: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit_note</span> Add Note
            </button>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Quantity Controls */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: '#FFF5F7',
            borderRadius: '8px',
            border: '1px solid #FCE7F3'
          }}>
            <button 
              onClick={onDecrease}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>remove</span>
            </button>
            <div style={{ width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{quantity}</div>
            <button 
              onClick={onIncrease}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-primary)', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
            </button>
          </div>
          
          {/* Total Price and Remove */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <button 
              onClick={onRemove}
              style={{ background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
            </button>
            <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              ₹{price * quantity}
            </div>
          </div>
        </div>
      </div>
      
      {showNote && onNoteChange && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', fontSize: '16px' }}>edit_note</span>
          <input
            type="text"
            placeholder="Special instructions (e.g. less sugar, cut in half)"
            value={note || ''}
            onChange={(e) => onNoteChange(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 32px',
              border: '1px solid #F1F5F9',
              borderRadius: '6px',
              fontSize: '13px',
              background: '#F8FAFC'
            }}
          />
          <button 
            onClick={() => {
              setShowNote(false);
              onNoteChange('');
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>cancel</span>
          </button>
        </div>
      )}
    </div>
  );
};
