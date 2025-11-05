import Navigation from "@/components/Navigation";
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
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-4" data-testid="heading-blog">Design Blog</h1>
        <p className="text-xl text-stone-600 dark:text-stone-400 mb-12">
          Tips, trends, and inspiration for your interior design journey
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {blogPosts.map((post, idx) => (
            <Card key={idx} className="overflow-hidden hover-elevate cursor-pointer" data-testid={`blog-post-${idx}`}>
              <img
                src={post.image}
                alt={post.title}
                className="w-full h-64 object-cover"
              />
              <div className="p-6">
                <p className="text-sm text-green-500 font-semibold mb-2">{post.date}</p>
                <h3 className="text-2xl font-bold mb-3">{post.title}</h3>
                <p className="text-stone-600 dark:text-stone-400">{post.excerpt}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
