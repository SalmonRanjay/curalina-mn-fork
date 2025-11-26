import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";
import GlobalLayout from "@/components/GlobalLayout";

export default function NotFound() {
  return (
    <GlobalLayout>
      <div className="flex-1 flex items-center justify-center p-4 py-24">
        <div className="text-center max-w-md">
          <h1 
            className="font-cormorant text-foreground mb-4"
            style={{ fontSize: "clamp(4rem, 10vw, 8rem)", fontWeight: 500, lineHeight: 1 }}
            data-testid="heading-404"
          >
            404
          </h1>
          <h2 
            className="font-cormorant text-foreground mb-4"
            style={{ fontSize: "var(--font-size-2xl)", fontWeight: 500 }}
          >
            Page Not Found
          </h2>
          <p 
            className="text-muted-foreground mb-8 font-inter"
            style={{ fontSize: "var(--font-size-base)" }}
          >
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/">
              <Button data-testid="button-go-home">
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => window.history.back()}
              data-testid="button-go-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
}
