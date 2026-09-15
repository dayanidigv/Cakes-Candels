import React from 'react';
import './Categories.css';

const categories = [
  { icon: '🎂', label: 'Cakes', sub: 'Premium Cakes', color: '#e81c70' },
  { icon: '🧁', label: 'Cupcakes', sub: 'Delicious Bites', color: '#e81c70' },
  { icon: '🍰', label: 'Pastries', sub: 'Melts in Mouth', color: '#f5a623' },
  { icon: '📷', label: 'Photo Cakes', sub: 'Your Memories', color: '#0bb5aa' },
  { icon: '✨', label: 'Custom Cakes', sub: 'Made for You', color: '#0bb5aa' },
  { icon: '🎁', label: 'Combos', sub: 'Best Offers', color: '#e81c70' },
];

export const Categories: React.FC = () => {
  return (
    <section className="categories-section">
      <div className="container">
        <div className="categories-grid">
          {categories.map((cat, i) => (
            <button key={i} className="category-card" style={{ '--accent': cat.color } as React.CSSProperties}>
              <div className="category-icon">{cat.icon}</div>
              <div className="category-label">{cat.label}</div>
              <div className="category-sub">{cat.sub}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
