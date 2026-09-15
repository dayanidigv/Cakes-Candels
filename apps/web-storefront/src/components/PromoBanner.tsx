import React from 'react';
import './PromoBanner.css';

const stats = [
  { value: '50K+', label: 'Happy Customers', icon: '😊' },
  { value: '100+', label: 'Cake Varieties', icon: '🎂' },
  { value: '10+', label: 'Branches', icon: '📍' },
  { value: '4.9★', label: 'Customer Rating', icon: '⭐' },
];

export const PromoBanner: React.FC = () => {
  return (
    <section className="promo-banner">
      <div className="container promo-inner">
        <div className="promo-left">
          <div className="promo-cupcake">🧁</div>
          <div>
            <p className="promo-heading">Planning a celebration?</p>
            <p className="promo-sub">We make every moment sweeter!</p>
          </div>
        </div>
        <a href="#" className="promo-cta-btn">
          Create Your Custom Cake →
        </a>
        <div className="promo-stats">
          {stats.map((s, i) => (
            <div key={i} className="stat-item">
              <span className="stat-icon">{s.icon}</span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
