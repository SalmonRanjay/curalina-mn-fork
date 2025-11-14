import { Link } from "wouter";

const footerLinks = {
  company: {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Press", href: "/press" },
      { label: "Partner with Us", href: "/partners" },
    ],
  },
  help: {
    title: "Help",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "Shipping", href: "/shipping" },
      { label: "Returns", href: "/returns" },
    ],
  },
  resources: {
    title: "Resources",
    links: [
      { label: "Style Quiz", href: "/quiz" },
      { label: "The Edit", href: "/edit" },
      { label: "Before & After", href: "/before-after" },
    ],
  },
};

export default function Footer() {
  return (
    <footer className="bg-muted py-12 border-t border-border" data-testid="footer">
      <div className="max-w-[1120px] mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Logo & Tagline */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="font-cormorant font-medium text-foreground mb-2" style={{ fontSize: 'var(--font-size-2xl)' }} data-testid="footer-logo">
              Curalina
            </h3>
            <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-tagline">
              Crafted for real life, elevated for everyday.
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-inter font-semibold text-foreground mb-4 uppercase tracking-wider" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-heading-company">
              {footerLinks.company.title}
            </h4>
            <ul className="space-y-2">
              {footerLinks.company.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }} data-testid={`footer-link-${link.label.toLowerCase().replace(/ /g, "-")}`}>
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help Links */}
          <div>
            <h4 className="font-inter font-semibold text-foreground mb-4 uppercase tracking-wider" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-heading-help">
              {footerLinks.help.title}
            </h4>
            <ul className="space-y-2">
              {footerLinks.help.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }} data-testid={`footer-link-${link.label.toLowerCase().replace(/ /g, "-")}`}>
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources Links */}
          <div>
            <h4 className="font-inter font-semibold text-foreground mb-4 uppercase tracking-wider" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-heading-resources">
              {footerLinks.resources.title}
            </h4>
            <ul className="space-y-2">
              {footerLinks.resources.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span className="text-muted-foreground hover:text-accent transition-colors cursor-pointer" style={{ fontSize: 'var(--font-size-sm)' }} data-testid={`footer-link-${link.label.toLowerCase().replace(/ /g, "-")}`}>
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-copyright">
            © {new Date().getFullYear()} Curalina. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="/terms" className="text-muted-foreground hover:text-accent transition-colors" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-link-terms">
              Terms
            </a>
            <a href="/privacy" className="text-muted-foreground hover:text-accent transition-colors" style={{ fontSize: 'var(--font-size-sm)' }} data-testid="footer-link-privacy">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
