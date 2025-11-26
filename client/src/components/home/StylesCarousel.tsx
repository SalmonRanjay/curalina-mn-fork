import { Card } from "@/components/ui/card";
import organicModern from "@assets/stock_images/organic_modern_bedro_d4118219.jpg";
import modernFarmhouse from "@assets/stock_images/modern_farmhouse_din_1ee52001.jpg";
import midcenturyScandi from "@assets/stock_images/midcentury_scandinav_77cf4d78.jpg";
import contemporaryLuxe from "@assets/stock_images/contemporary_luxe_be_e74c2402.jpg";
import warmTransitional from "@assets/stock_images/warm_transitional_li_b3bb947d.jpg";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

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
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();

  const handleStyleClick = (styleId: string) => {
    const quizUrl = `/quiz?style=${encodeURIComponent(styleId)}`;
    if (isAuthenticated) {
      setLocation(quizUrl);
    } else {
      setLocation(`/register?redirectTo=${encodeURIComponent(quizUrl)}`);
    }
  };

  return (
    <section id="styles" className="bg-background section-padding scroll-mt-20" data-testid="section-styles-carousel">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16">
        {/* Section Title */}
        <div className="text-center mb-12 md:mb-16 stack-tight flex flex-col items-center">
          <h2 className="font-serif font-medium text-foreground" 
              style={{ fontSize: 'var(--font-size-3xl)' }}
              data-testid="heading-find-your-look">
            Find your look
          </h2>
          <p className="text-muted-foreground max-w-2xl" 
             style={{ fontSize: 'var(--font-size-base)' }}>
            Explore our curated design styles — each one crafted to help you express your unique taste
          </p>
        </div>

        {/* Horizontal Scroll Container */}
        <div className="overflow-x-auto pb-6 -mx-6 px-6" data-testid="carousel-styles">
          <div className="flex gap-6 lg:gap-8 min-w-max">
            {styles.map((style) => (
              <Card 
                key={style.id}
                onClick={() => handleStyleClick(style.id)}
                className="w-80 overflow-hidden hover-elevate active-elevate-2 cursor-pointer transition-all border-card-border group"
                data-testid={`card-style-${style.id.toLowerCase().replace(/ /g, "-")}`}
              >
                <div className="relative overflow-hidden">
                  <img 
                    src={style.image} 
                    alt={style.name} 
                    className="w-full h-56 object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                    data-testid={`img-style-${style.id.toLowerCase().replace(/ /g, "-")}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-background font-medium" style={{ fontSize: 'var(--font-size-sm)' }}>Explore this style</p>
                  </div>
                </div>
                <div className="p-5 stack-tight flex flex-col">
                  <h3 className="font-semibold text-card-foreground" 
                      style={{ fontSize: 'var(--font-size-lg)' }}
                      data-testid={`heading-style-${style.id.toLowerCase().replace(/ /g, "-")}`}>
                    {style.name}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed" style={{ fontSize: 'var(--font-size-sm)' }} data-testid={`text-style-${style.id.toLowerCase().replace(/ /g, "-")}`}>
                    {style.tagline}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
