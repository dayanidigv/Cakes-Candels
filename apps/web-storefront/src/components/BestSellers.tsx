import React, { useState } from 'react';
import { Heart, ShoppingCart } from 'lucide-react';
import './BestSellers.css';

const products = [
  { id: 1, name: 'Chocolate Truffle', price: 850, image: '/cake-choc-truffle.jpg' },
  { id: 2, name: 'Red Velvet Cake', price: 950, image: '/cake-red-velvet.jpg' },
  { id: 3, name: 'Butterscotch Cake', price: 800, image: '/cake-butterscotch.jpg' },
  { id: 4, name: 'Black Forest Cake', price: 850, image: '/cake-black-forest.jpg' },
  { id: 5, name: 'Chocolate Drip Cake', price: 1050, image: '/cake-choc-drip.jpg' },
];

export const BestSellers: React.FC = () => {
  const [liked, setLiked] = useState<number[]>([]);
  const [added, setAdded] = useState<number[]>([]);

  const toggleLike = (id: number) => {
    setLiked(l => l.includes(id) ? l.filter(x => x !== id) : [...l, id]);
  };

  const addToCart = (id: number) => {
    setAdded(a => [...a, id]);
    setTimeout(() => setAdded(a => a.filter(x => x !== id)), 1500);
  };

  return (
    <section className="bestsellers-section">
      <div className="container">
        <div className="bestsellers-header">
          <div className="bestsellers-title-block">
            <span className="bestsellers-icon">🏆</span>
            <h2 className="bestsellers-title">Best Sellers</h2>
          </div>
          <a href="#" className="view-all-link">View All Cakes →</a>
        </div>
        <div className="products-grid">
          {products.map(product => (
            <div key={product.id} className="product-card">
              <div className="product-image-wrapper">
                <img src={product.image} alt={product.name} className="product-image" />
                <button
                  className={`wishlist-btn ${liked.includes(product.id) ? 'liked' : ''}`}
                  onClick={() => toggleLike(product.id)}
                  aria-label="Add to wishlist"
                >
                  <Heart size={16} fill={liked.includes(product.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="product-info">
                <h3 className="product-name">{product.name}</h3>
                <p className="product-price">₹{product.price}</p>
              </div>
              <button
                className={`add-to-cart-btn ${added.includes(product.id) ? 'added' : ''}`}
                onClick={() => addToCart(product.id)}
              >
                <ShoppingCart size={16} />
                {added.includes(product.id) ? 'Added!' : 'Add to Cart'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
