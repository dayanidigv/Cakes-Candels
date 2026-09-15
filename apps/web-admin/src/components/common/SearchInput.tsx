import React, { useState, useEffect } from 'react';

export const SearchInput = ({ value, onChange, placeholder = 'Search...' }: any) => {
  const [localVal, setLocalVal] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      if (localVal !== value) onChange(localVal);
    }, 400);
    return () => clearTimeout(handler);
  }, [localVal, onChange, value]);

  return (
    <div style={{ position: 'relative', width: '250px' }}>
      <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-secondary)', fontSize: '18px' }}>search</span>
      <input 
        type="text" 
        value={localVal} 
        onChange={e => setLocalVal(e.target.value)} 
        placeholder={placeholder} 
        style={{ width: '100%', padding: '8px 12px 8px 38px', background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-text-primary)', outline: 'none' }} 
      />
    </div>
  );
};
