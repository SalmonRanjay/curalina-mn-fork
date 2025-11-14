import { Card } from "@/components/ui/card";
import organicModern from "@assets/stock_images/organic_modern_bedro_d4118219.jpg";
import modernFarmhouse from "@assets/stock_images/modern_farmhouse_din_1ee52001.jpg";
import midcenturyScandi from "@assets/stock_images/midcentury_scandinav_77cf4d78.jpg";
import contemporaryLuxe from "@assets/stock_images/contemporary_luxe_be_e74c2402.jpg";
import warmTransitional from "@assets/stock_images/warm_transitional_li_b3bb947d.jpg";
import { Link } from "wouter";

const styles = [
  {
    id: "Organic Modern",
    name: "Organic Modern",
    tagline: "Soft, calm, natural",
    image: organicModern,
  },
  {
    id: "Modern Farmhouse",
    name: "Modern Farmhouse",
    tagline: "Rustic, cozy, vintage charm",
    image: modernFarmhouse,
  },
  {
    id: "Midcentury Scandi",
    name: "Midcentury Scandi",
    tagline: "Vintage, retro, functional",
    image: midcenturyScandi,
  },
  {
    id: "Contemporary Luxe",
    name: "Contemporary Luxe",
    tagline: "Sleek, sophisticated, elegant",
    image: contemporaryLuxe,
  },
  {
    id: "Warm Transitional",
    name: "Warm Transitional",
    tagline: "Comfortable, timeless, refined",
    image: warmTransitional,
  },
];

export default function StylesCarousel() {
  return (
    <section id="styles" className="bg-[#FAF9F7] py-16 md:py-24 scroll-mt-20" data-testid="section-styles-carousel">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <h2 className="text-3xl md:text-4xl font-cormorant font-medium text-center text-stone-900 mb-12" data-testid="heading-find-your-look">
          Find your look
        </h2>

        {/* Horizontal Scroll Container */}
        <div className="overflow-x-auto pb-4" data-testid="carousel-styles">
          <div className="flex gap-6 min-w-max">
            {styles.map((style) => (
              <Link key={style.id} href={`/quiz?style=${encodeURIComponent(style.id)}`}>
                <Card 
                  className="w-72 overflow-hidden hover-elevate active-elevate-2 cursor-pointer transition-all border border-stone-200 group"
                  data-testid={`card-style-${style.id.toLowerCase().replace(/ /g, "-")}`}
                >
                  <div className="relative overflow-hidden">
                    <img 
                      src={style.image} 
                      alt={style.name} 
                      className="w-full h-48 object-cover transition-transform duration-300 group-hover:scale-105"
                      data-testid={`img-style-${style.id.toLowerCase().replace(/ /g, "-")}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-inter font-semibold text-stone-900 mb-1" data-testid={`heading-style-${style.id.toLowerCase().replace(/ /g, "-")}`}>
                      {style.name}
                    </h3>
                    <p className="text-sm text-stone-600" data-testid={`text-style-${style.id.toLowerCase().replace(/ /g, "-")}`}>
                      {style.tagline}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
