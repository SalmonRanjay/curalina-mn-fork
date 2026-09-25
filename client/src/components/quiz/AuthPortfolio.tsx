import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { ChromeHeader, ChromeFooter } from "./QuizChrome";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({ id, label, type = "text", value, onChange, testId, autoComplete }: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void; testId: string; autoComplete?: string;
}) {
  return (
    <div className="cc-reveal">
      <label htmlFor={id} className="block text-lg mb-1 text-[#57524f]">{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete} onChange={(e) => onChange(e.target.value)} className="cc-field" data-testid={testId} />
    </div>
  );
}

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return show ? <>{children}</> : null;
}

async function readError(res: Response, fallback: string) {
  try {
    const body = await res.json();
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
}

function SignIn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(await readError(res, "Login failed"));
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Logged in successfully" });
      try {
        const userResponse = await fetch("/api/auth/user", { credentials: "include" });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.role === "admin") {
            setLocation("/admin");
            return;
          }
        }
      } catch (error) {
        console.error("Error fetching user data for redirect:", error);
      }
      setLocation("/my-dashboard");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Login failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const emailOk = EMAIL_RE.test(email);
  return (
    <form onSubmit={submit} className="space-y-8" data-testid="form-signin">
      <h2 className="text-3xl font-normal">Sign In</h2>
      <Field id="signin-email" label="Email" type="email" value={email} onChange={setEmail} testId="input-email" autoComplete="email" />
      <Reveal show={emailOk}>
        <Field id="signin-password" label="Password" type="password" value={password} onChange={setPassword} testId="input-password" autoComplete="current-password" />
      </Reveal>
      <Reveal show={emailOk && password.length > 0}>
        <div className="cc-reveal">
          <button type="submit" disabled={busy} className="cc-btn w-full" data-testid="button-login">{busy ? "Signing in..." : "Sign In"}</button>
        </div>
      </Reveal>
      <button
        type="button"
        className="block text-xl text-[#57524f] hover:text-[#231f20] transition-colors"
        onClick={() => toast({ title: "Not available yet", description: "Password reset is not connected yet." })}
      >
        Forgot Password
      </button>
    </form>
  );
}

function SignUp({ redirectTo }: { redirectTo: string | null }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);

  const emailOk = EMAIL_RE.test(email);
  const passwordOk = password.length >= 8;
  const matches = passwordOk && verify === password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, firstName: firstName.trim(), lastName: lastName.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res, "Registration failed"));
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Success", description: "Account created successfully" });
      setLocation(redirectTo || "/my-dashboard");
    } catch (error) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Registration failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8" data-testid="form-signup">
      <h2 className="text-3xl font-normal">Sign Up</h2>
      <Field id="signup-email" label="Email" type="email" value={email} onChange={setEmail} testId="input-email-signup" autoComplete="email" />
      <Reveal show={emailOk}>
        <Field id="signup-password" label="Password" type="password" value={password} onChange={setPassword} testId="input-password-signup" autoComplete="new-password" />
      </Reveal>
      <Reveal show={emailOk && passwordOk}>
        <Field id="signup-verify" label="Verify Password" type="password" value={verify} onChange={setVerify} testId="input-confirmPassword" autoComplete="new-password" />
      </Reveal>
      {/* The registration API still requires first/last name and the mockup has no such fields, so they
          appear only after the passwords match rather than being invented. */}
      <Reveal show={matches}>
        <div className="grid grid-cols-2 gap-6">
          <Field id="signup-first" label="First name" value={firstName} onChange={setFirstName} testId="input-firstName" autoComplete="given-name" />
          <Field id="signup-last" label="Last name" value={lastName} onChange={setLastName} testId="input-lastName" autoComplete="family-name" />
        </div>
      </Reveal>
      <Reveal show={matches && firstName.trim().length > 0 && lastName.trim().length > 0}>
        <div className="cc-reveal">
          <button type="submit" disabled={busy} className="cc-btn w-full" data-testid="button-register">{busy ? "Creating account..." : "Agree and Continue"}</button>
        </div>
      </Reveal>
      <p className="text-lg leading-relaxed font-light">
        By signing in or clicking &ldquo;Agree and Continue,&rdquo; you agree to our <a href="/terms" className="text-[#7f807a]">Terms of Service</a>. Please read our <a href="/privacy">Privacy Policy</a>.
      </p>
    </form>
  );
}

/** Page 3 "Project Portfolio": sign in and sign up side by side, progressive disclosure, no heavy boxes. */
export default function AuthPortfolio({ redirectTo = null }: { redirectTo?: string | null }) {
  return (
    <div className="cc-root min-h-screen flex flex-col">
      <ChromeHeader />
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 md:px-14 pt-12 md:pt-16 pb-24">
        <h1 className="cc-heading mb-14" data-testid="heading-portfolio">Project Portfolio</h1>
        <div className="grid gap-16 md:grid-cols-2 md:gap-24 items-start">
          <SignIn />
          <SignUp redirectTo={redirectTo} />
        </div>
      </main>
      <ChromeFooter />
    </div>
  );
}
