import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { ProductsPage } from './pages/ProductsPage';
import { CheckoutPage } from './pages/Checkout';
import './App.css';

function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
          </Routes>
        </main>
        
        <footer className="footer">
          <div className="container footer-inner">
            <div className="footer-brand">
              <div className="footer-logo">Cakes & Candles</div>
              <p className="footer-tagline">Baked with love, lit with joy.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Quick Links</h4>
                <a href="/">Home</a>
                <a href="/products">Cakes</a>
                <a href="#">Custom Cakes</a>
                <a href="#">Offers</a>
              </div>
              <div className="footer-col">
                <h4>Info</h4>
                <a href="#">About Us</a>
                <a href="#">Gallery</a>
                <a href="#">Branches</a>
                <a href="#">Contact</a>
              </div>
              <div className="footer-col">
                <h4>Contact</h4>
                <a href="tel:+919876543210">+91 98765 43210</a>
                <a href="mailto:hello@cakescandles.in">hello@cakescandles.in</a>
                <p>Order before 6PM for same-day delivery!</p>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <div className="container">
              © 2026 Cakes & Candles. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
