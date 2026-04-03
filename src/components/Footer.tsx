import { Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left side — optional brand text */}
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Bloomy LMS. All rights reserved.
          </p>

          {/* Right side — credit */}
          <a
            href="https://www.linkedin.com/in/koredesamuel"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2 transition-colors duration-200"
          >
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-200">
              Built by&nbsp;
            </span>
            <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground underline-offset-4 group-hover:underline transition-colors duration-200">
              Korede Samuel
            </span>
            <Linkedin
              className="text-[#0A66C2] group-hover:brightness-110 transition-all duration-200"
              size={18}
              strokeWidth={1.8}
            />
          </a>
        </div>
      </div>
    </footer>
  );
}