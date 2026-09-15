import React from 'react';
import './Features.css';

const features = [
  { icon: '🌿', title: 'Fresh Ingredients', sub: 'Always 100% fresh' },
  { icon: '❤️', title: 'Handcrafted', sub: 'Made with love' },
  { icon: '🚚', title: 'On-time Delivery', sub: 'Across all locations' },
  { icon: '📦', title: 'Safe Packaging', sub: 'Hygienic & secure' },
  { icon: '⭐', title: 'Best Quality', sub: 'Trusted by thousands' },
];

export const Features: React.FC = () => {
  return (
    <section className="features-section">
      <div className="container">
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-item">
              <div className="feature-icon">{f.icon}</div>
              <div className="feature-text">
                <div className="feature-title">{f.title}</div>
                <div className="feature-sub">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
