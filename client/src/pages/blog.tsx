import GlobalLayout from "@/components/GlobalLayout";
import { Card } from "@/components/ui/card";

const blogPosts = [
  {
    title: "5 Interior Design Trends for 2024",
    excerpt: "Discover the hottest interior design trends that are shaping homes this year, from sustainable materials to bold color choices.",
    date: "November 1, 2024",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&h=400&fit=crop"
  },
  {
    title: "How to Choose the Perfect Color Palette",
    excerpt: "Learn the secrets to selecting colors that create harmony and reflect your personal style in every room.",
    date: "October 28, 2024",
    image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=400&fit=crop"
  },
  {
    title: "Maximizing Small Spaces with Smart Design",
    excerpt: "Transform cramped rooms into functional, beautiful spaces with these expert tips and tricks.",
    date: "October 25, 2024",
    image: "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&h=400&fit=crop"
  },
  {
    title: "The Ultimate Guide to Mid-Century Modern Style",
    excerpt: "Everything you need to know about one of the most enduring and popular interior design styles.",
    date: "October 20, 2024",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=400&fit=crop"
  }
];

export default function Blog() {
  return (
    <GlobalLayout>
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-16 py-16">
        <h1 
          className="font-cormorant text-foreground mb-4" 
          style={{ fontSize: "clamp(2.5rem, 5vw, 3.5rem)", fontWeight: 500 }}
          data-testid="heading-blog"
        >
          The Edit
        </h1>
        <p 
          className="text-muted-foreground mb-12 font-inter"
          style={{ fontSize: "var(--font-size-lg)" }}
        >
          Tips, trends, and inspiration for your interior design journey
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {blogPosts.map((post, idx) => (
            <Card 
              key={idx} 
              className="overflow-hidden hover-elevate cursor-pointer border-border" 
              data-testid={`blog-post-${idx}`}
            >
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-64 object-cover"
              />
              <div className="p-6">
                <p 
                  className="text-accent font-semibold mb-2 font-inter"
                  style={{ fontSize: "var(--font-size-sm)" }}
                >
                  {post.date}
                </p>
                <h3 
                  className="font-cormorant text-foreground mb-3"
                  style={{ fontSize: "var(--font-size-2xl)", fontWeight: 500 }}
                >
                  {post.title}
                </h3>
                <p 
                  className="text-muted-foreground font-inter"
                  style={{ fontSize: "var(--font-size-base)" }}
                >
                  {post.excerpt}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </GlobalLayout>
  );
}
