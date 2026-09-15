import React from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart, User, MapPin, Phone, Heart } from 'lucide-react';
import { useCartStore } from '../stores/useCartStore';
import './Header.css';

export const Header: React.FC = () => {
  const { itemCount, customer } = useCartStore();
  const count = itemCount();

  return (
    <header className="header">
      <div className="header-top">
        <div className="container flex-between">
          <div className="flex-center gap-sm text-sm">
            <Heart size={14} fill="currentColor" />
            <span>Baked with love, lit with joy.</span>
          </div>
          <div className="text-sm">
            Order before 6PM for same-day delivery!
          </div>
          <div className="flex-center gap-md text-sm">
            <div className="flex-center gap-xs">
              <Phone size={14} />
              <span>+91 98765 43210</span>
            </div>
            <div className="flex-center gap-xs">
              <MapPin size={14} />
              <span>Find a Branch</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="header-main container flex-between">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <div className="logo-text">Cakes & Candles</div>
          <div className="logo-subtext">CAKE SHOP</div>
        </Link>
        
        <nav className="nav-links">
          <Link to="/" className="active">Home</Link>
          <Link to="/products">Cakes</Link>
          <a href="#">Custom Cakes</a>
          <a href="#">Offers</a>
          <a href="#">Gallery</a>
          <a href="#">Branches</a>
          <a href="#">About Us</a>
          <a href="#">Contact</a>
        </nav>
        
        <div className="header-actions flex-center gap-md">
          <button className="icon-btn" aria-label="Search">
            <Search size={20} />
          </button>
          
          <Link to="/checkout" className="icon-btn cart-btn" aria-label="Cart">
            <ShoppingCart size={20} />
            {count > 0 && <span className="cart-badge">{count}</span>}
          </Link>
          
          {customer ? (
            <div className="flex-center gap-sm" style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
              <User size={16} />
              {customer.fullName || customer.phone}
            </div>
          ) : (
            <button className="btn btn-primary login-btn">
              <User size={16} />
              Login / Sign Up
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
