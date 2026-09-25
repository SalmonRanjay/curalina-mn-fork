import { useEffect, useState } from "react";
import AuthPortfolio from "@/components/quiz/AuthPortfolio";

export default function Register() {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  useEffect(() => {
    setRedirectTo(new URLSearchParams(window.location.search).get("redirectTo"));
  }, []);
  return <AuthPortfolio redirectTo={redirectTo} />;
}
