import { useState } from "react";
import { Link } from "wouter";
import { Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import "./consultation.css";

function initialsOf(user: { firstName: string | null; lastName: string | null; email: string }) {
  const f = user.firstName?.trim()[0];
  const l = user.lastName?.trim()[0];
  const fromName = `${f ?? ""}${l ?? ""}`.toUpperCase();
  return fromName || user.email.trim()[0]?.toUpperCase() || "";
}

/** Near-black header: hamburger left, script wordmark centre, initials/person circle right. */
export function ChromeHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/", label: "Home" },
    { href: "/styles", label: "Design Styles" },
    { href: "/pricing", label: "Pricing" },
    { href: "/about", label: "About" },
    { href: user ? "/my-dashboard" : "/login", label: user ? "My Projects" : "Sign In" },
  ];
  return (
    <header className="cc-header" data-testid="chrome-header">
      <div className="relative flex items-center justify-between h-20 md:h-24 px-6 md:px-14">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button aria-label="Open menu" className="!text-white/90 hover:!text-white transition-colors" data-testid="button-menu">
              <Menu className="w-7 h-7" strokeWidth={1} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="cc-root !bg-white !text-[#231f20] border-r border-[#231f20]/20 [&>button]:!text-[#231f20] [&>button_svg]:!text-[#231f20]">
            <SheetTitle className="cc-wordmark !text-[#231f20]">Curalina &amp; Co.</SheetTitle>
            <nav className="mt-8 flex flex-col gap-5">
              {links.map((l) => (
                <Link key={l.href} href={l.href}>
                  <span onClick={() => setOpen(false)} className="cursor-pointer text-lg !text-[#231f20] hover:!text-[#7f807a] transition-colors">{l.label}</span>
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/">
          <span className="cc-wordmark absolute left-1/2 -translate-x-1/2 cursor-pointer whitespace-nowrap" data-testid="link-logo-quiz">
            Curalina &amp; Co.
          </span>
        </Link>

        <Link href={user ? "/my-dashboard" : "/login"}>
          <span
            className="w-11 h-11 md:w-12 md:h-12 rounded-full border border-white/80 flex items-center justify-center text-white cursor-pointer text-sm tracking-wide"
            aria-label={user ? "Your account" : "Sign in"}
            data-testid="chrome-account"
          >
            {user ? initialsOf(user) : <User className="w-6 h-6" strokeWidth={1} />}
          </span>
        </Link>
      </div>
    </header>
  );
}

const columns: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
  { title: "Company", links: [{ label: "About us", href: "/about" }, { label: "Partner with Us", href: "/partners" }, { label: "Contact Us", href: "/contact" }] },
  { title: "Support", links: [{ label: "Delivery & Shipping", href: "/shipping" }, { label: "Returns & Exchanges", href: "/returns" }, { label: "FAQ", href: "/faq" }] },
  { title: "Explore", links: [{ label: "Design Styles", href: "/styles" }, { label: "Before & After", href: "/before-after" }, { label: "Pricing", href: "/pricing" }] },
];

/** Shared footer from the consultation mockups. */
export function ChromeFooter() {
  const { toast } = useToast();
  return (
    <footer className="bg-white" data-testid="chrome-footer">
      <div className="max-w-[1400px] mx-auto px-6 md:px-14 pt-16 pb-14 grid gap-10 md:grid-cols-[auto_1fr_1fr_1fr_1.4fr] items-start">
        <div className="w-28 h-28 rounded-full border border-[#231f20] flex items-center justify-center" aria-label="Curalina & Co. monogram">
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "2.6rem" }}>CC</span>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h3 className="text-xl font-normal mb-5">{c.title}</h3>
            <ul className="space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href}><span className="cursor-pointer font-light text-[#57524f] hover:text-[#231f20] transition-colors">{l.label}</span></Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h3 className="text-xl font-normal mb-4">Stay Connected</h3>
          <p className="font-light text-[#57524f] mb-4">Receive occasional updates, new releases, and design insights.</p>
          <form
            className="flex border border-[#231f20]/70 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              // No newsletter backend exists yet; say so rather than pretend to subscribe.
              toast({ title: "Not available yet", description: "Email updates are not connected yet." });
            }}
          >
            <input type="email" aria-label="email address" placeholder="email address" className="flex-1 bg-transparent px-3 py-2 italic font-light outline-none" />
            <button type="submit" aria-label="Subscribe" className="px-3">&gt;</button>
          </form>
        </div>
      </div>
      <div className="bg-[#f4f6f5]">
        <div className="max-w-[1400px] mx-auto px-6 md:px-14 py-6 flex flex-wrap items-center justify-between gap-4 font-light text-[#57524f]">
          <div className="flex gap-8">
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/privacy">Privacy Policy</a>
          </div>
          <span>Curalina &amp; Co. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
