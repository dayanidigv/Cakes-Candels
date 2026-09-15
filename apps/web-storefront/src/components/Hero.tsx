import React from 'react';
import './Hero.css';

export const Hero: React.FC = () => {
  return (
    <section className="hero">
      <div className="hero-background"></div>
      <div className="container hero-content">
        <div className="hero-text-content">
          <h2 className="hero-subtitle">Made for your</h2>
          <h1 className="hero-title">Sweetest Moments</h1>
          <p className="hero-description">
            Handcrafted cakes and delightful treats for every celebration.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary">Explore Cakes</button>
            <button className="btn btn-outline">Custom Cake</button>
          </div>
        </div>
        <div className="hero-image-container">
          <img 
            src="/hero-cake.jpg" 
            alt="Beautiful Birthday Cake" 
            className="hero-image"
          />
        </div>
      </div>
    </section>
  );
};
