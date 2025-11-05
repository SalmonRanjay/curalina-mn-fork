import Navigation from "@/components/Navigation";

export default function About() {
  return (
    <div className="min-h-screen bg-white dark:bg-stone-950">
      <Navigation />
      <div className="h-28"></div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold mb-8" data-testid="heading-about">About Us</h1>
        
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p className="text-xl text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
            Curalina AI is revolutionizing interior design by combining artificial intelligence with professional design expertise to create personalized spaces that feel like home.
          </p>

          <h2 className="text-3xl font-bold mt-12 mb-4">Our Mission</h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
            We believe everyone deserves a beautifully designed space that reflects their unique style and personality. Our mission is to make professional interior design accessible, affordable, and effortless through the power of AI technology.
          </p>

          <h2 className="text-3xl font-bold mt-12 mb-4">How We Work</h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
            Our AI-powered platform analyzes your preferences, room dimensions, and style choices to generate photorealistic interior designs in minutes. Every furniture piece is handpicked by our team of professional interior designers from over 300 premium Canadian suppliers.
          </p>

          <h2 className="text-3xl font-bold mt-12 mb-4">Why Choose Us</h2>
          <ul className="space-y-4 text-lg text-stone-600 dark:text-stone-400">
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span><strong>Canadian Designed:</strong> All our furniture selections are sourced from premium Canadian suppliers</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span><strong>AI-Powered:</strong> Advanced technology creates personalized designs in minutes</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span><strong>Expert Curated:</strong> Every piece is vetted by professional interior designers</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-500 font-bold">•</span>
              <span><strong>Affordable:</strong> Professional design services at a fraction of traditional costs</span>
            </li>
          </ul>

          <h2 className="text-3xl font-bold mt-12 mb-4">Our Team</h2>
          <p className="text-lg text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
            Founded by a team of interior designers and technology enthusiasts, Curalina AI combines decades of design experience with cutting-edge artificial intelligence to deliver stunning results.
          </p>
        </div>
      </div>
    </div>
  );
}
