import Header from "@/components/home/Header";
import HeroSection from "@/components/home/HeroSection";
import HowItWorks from "@/components/home/HowItWorks";
import StylesCarousel from "@/components/home/StylesCarousel";
import ValueProposition from "@/components/home/ValueProposition";
import Testimonials from "@/components/home/Testimonials";
import CTABand from "@/components/home/CTABand";
import Footer from "@/components/home/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FAF9F7]" data-testid="page-home">
      <Header />
      <main>
        <HeroSection />
        <HowItWorks />
        <StylesCarousel />
        <ValueProposition />
        <Testimonials />
        <CTABand />
      </main>
      <Footer />
    </div>
  );
}
