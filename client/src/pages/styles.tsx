import Navigation from "@/components/Navigation";
import { Card } from "@/components/ui/card";

const STYLES_DATA = [
  {
    name: "Mid Century Scandi",
    description: "Vintage, retro, functional, warm, clean, natural, refined",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=600&fit=crop"
  },
  {
    name: "Organic Modern",
    description: "Earthy, uncluttered, tranquil, zen-inspired, textural, rounded edges",
    image: "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=600&fit=crop"
  },
  {
    name: "Artful Eclectic",
    description: "Unexpected, playful, expressive, soulful, layered, creative, vibrant",
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop"
  },
  {
    name: "Modern Farmhouse",
    description: "Rustic, casual, heritage-inspired, cozy, wholesome, vintage charm",
    image: "https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=800&h=600&fit=crop"
  },
  {
    name: "Warm Transitional",
    description: "Timeless blend of traditional and modern, refined, classic, polished",
    image: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&h=600&fit=crop"
  },
  {
    name: "Modern Luxe",
    description: "Sophisticated, minimal yet rich, polished, glamorous, refined, sleek",
    image: "https://images.unsplash.com/photo-1600566753414-2afc9e2f5a28?w=800&h=600&fit=crop"
  }
];

export default function Styles() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-4" data-testid="heading-explore-styles">Explore Styles</h1>
        <p className="text-xl text-stone-600 dark:text-stone-400 mb-12">
          Discover our curated interior design styles and find the perfect look for your space.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {STYLES_DATA.map((style, idx) => (
            <Card key={idx} className="overflow-hidden hover-elevate" data-testid={`style-card-${idx}`}>
              <img
                src={style.image}
                alt={style.name}
                className="w-full h-64 object-cover"
              />
              <div className="p-6">
                <h3 className="text-2xl font-bold mb-2">{style.name}</h3>
                <p className="text-stone-600 dark:text-stone-400">{style.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
