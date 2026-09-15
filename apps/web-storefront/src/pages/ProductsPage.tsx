import { useEffect, useState } from 'react';
import { ProductCard } from '../components/products/ProductCard';
import { api } from '../services/api';

export function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getProducts();
        const items = Array.isArray(data) ? data : data?.items || [];
        if (items.length === 0) {
          throw new Error('No products found');
        }
        setProducts(items);
      } catch {
        // Mock fallback if API fails or returns empty
        setProducts([
          { id: '1', name: 'Black Forest Cake', price: 650, description: 'Classic black forest with fresh cherries' },
          { id: '2', name: 'Red Velvet', price: 750, description: 'Rich red velvet with cream cheese frosting' },
          { id: '3', name: 'Pineapple Cake', price: 550, description: 'Fresh pineapple chunks with vanilla sponge' },
          { id: '4', name: 'Chocolate Truffle', price: 850, description: 'Dense chocolate truffle cake' },
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="container" style={{ padding: '60px 20px', minHeight: '60vh' }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16 }}>Our Cakes</h1>
        <p style={{ color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto' }}>
          Explore our wide variety of freshly baked cakes, perfect for any occasion.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          Loading our delicious catalog...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 24 }}>
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
