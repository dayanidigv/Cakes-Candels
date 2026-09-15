import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../../stores/useCartStore';
import './ProductCard.css';

interface ProductCardProps {
  product: {
    id: string; // product id
    variantId?: string;
    name?: string;
    variantName?: string;
    description?: string;
    price?: number;
    retailPrice?: number;
    imageUrl?: string;
  };
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const addItem = useCartStore(state => state.addItem);
  
  const id = product.variantId || product.id;
  const name = product.name || product.variantName || 'Unknown Product';
  const price = product.price || product.retailPrice || 0;
  
  const handleAdd = () => {
    addItem({
      id,
      productId: product.id,
      variantId: product.variantId,
      name,
      price,
      imageUrl: product.imageUrl,
    });
  };

  return (
    <div className="product-card">
      <div className="product-image">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={name} />
        ) : (
          <div className="image-placeholder">🎂</div>
        )}
      </div>
      <div className="product-info">
        <h3 className="product-name">{name}</h3>
        {product.description && <p className="product-desc">{product.description}</p>}
        <div className="product-bottom">
          <span className="product-price">₹{price.toFixed(2)}</span>
          <button className="btn btn-primary add-to-cart-btn" onClick={handleAdd}>
            <ShoppingCart size={16} /> Add
          </button>
        </div>
      </div>
    </div>
  );
};
