import { Hero } from '../components/Hero';
import { Categories } from '../components/Categories';
import { Features } from '../components/Features';
import { BestSellers } from '../components/BestSellers';
import { PromoBanner } from '../components/PromoBanner';

export function Home() {
  return (
    <>
      <Hero />
      <Categories />
      <Features />
      <BestSellers />
      <PromoBanner />
    </>
  );
}
