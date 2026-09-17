import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, Loader2 } from "lucide-react";

interface AuthenticatedQuizButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  children?: React.ReactNode;
  showArrow?: boolean;
  "data-testid"?: string;
}

export function AuthenticatedQuizButton({
  variant = "default",
  size = "lg",
  className = "",
  children = "Take the Style Quiz",
  showArrow = true,
  "data-testid": testId = "button-take-quiz",
}: AuthenticatedQuizButtonProps) {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const handleClick = () => {
    if (isAuthenticated) {
      setLocation("/quiz");
    } else {
      setLocation("/register?redirectTo=/quiz");
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
      data-testid={testId}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          {children}
          {showArrow && <ArrowRight className="ml-2 w-5 h-5" />}
        </>
      )}
    </Button>
  );
}
