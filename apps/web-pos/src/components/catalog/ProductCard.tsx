import React from 'react';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  image?: string;
  imageUrl?: string;
  category: string;
  stockQuantity?: number;
  onClick: () => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ name, price, image, imageUrl, stockQuantity = 0, onClick }) => {
  const imgSrc = imageUrl || image;
  const isOutOfStock = stockQuantity <= 0;
  const isLowStock = stockQuantity > 0 && stockQuantity <= 5;

  return (
    <div 
      onClick={isOutOfStock ? undefined : onClick}
      style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid #F1F5F9',
        overflow: 'hidden',
        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxShadow: 'var(--shadow-sm)',
        padding: '16px',
        opacity: isOutOfStock ? 0.6 : 1,
        filter: isOutOfStock ? 'grayscale(0.5)' : 'none'
      }}
      onMouseOver={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }
      }}
      onMouseOut={(e) => {
        if (!isOutOfStock) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
          e.currentTarget.style.borderColor = '#F1F5F9';
        }
      }}
    >
      <div style={{ position: 'absolute', top: 12, right: 12 }}>
        <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>favorite_border</span>
      </div>

      <div style={{
        height: '140px',
        width: '100%',
        marginBottom: '12px',
        background: imgSrc ? `url(${imgSrc}) center/contain no-repeat` : 'var(--bg-app)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {!imgSrc && <span className="material-symbols-outlined" style={{ color: 'var(--text-muted)', fontSize: '48px', opacity: 0.3 }}>cake</span>}
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: '6px' }}>
          {name}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--color-primary)', marginBottom: '8px' }}>
          ₹{price}
        </div>
        
        {isOutOfStock ? (
          <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--color-danger)', background: '#FEE2E2', padding: '4px 8px', borderRadius: '4px' }}>
            OUT OF STOCK
          </div>
        ) : (
          <div style={{ fontSize: '12px', fontWeight: 600, color: isLowStock ? 'var(--color-warning)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLowStock ? 'var(--color-warning)' : 'var(--color-success)' }} />
            {isLowStock ? `${stockQuantity} left` : `${stockQuantity} available`}
          </div>
        )}
      </div>
    </div>
  );
};
