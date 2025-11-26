import Header from "@/components/home/Header";
import Footer from "@/components/home/Footer";

interface GlobalLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  className?: string;
}

export default function GlobalLayout({ 
  children, 
  showHeader = true, 
  showFooter = true,
  className = ""
}: GlobalLayoutProps) {
  return (
    <div className={`min-h-screen bg-background flex flex-col ${className}`} data-testid="global-layout">
      {showHeader && <Header />}
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
