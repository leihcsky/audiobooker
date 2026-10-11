type LogoMarkProps = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" fill="#6B3A24" />
      <rect x="5.5" y="9" width="10.2" height="14.5" rx="1.6" fill="#FFF8EE" />
      <rect x="16.3" y="9" width="10.2" height="14.5" rx="1.6" fill="#F3E6D4" />
      <rect x="15.1" y="9" width="1.8" height="14.5" fill="#E4D2B6" />
      <rect x="9.7" y="13.4" width="2.5" height="6" rx="1.25" fill="#E9782A" />
      <rect x="14.75" y="10.6" width="2.5" height="8.8" rx="1.25" fill="#FFB03A" />
      <rect x="19.8" y="13.4" width="2.5" height="6" rx="1.25" fill="#E9782A" />
    </svg>
  );
}

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
};

export function BrandLogo({
  className,
  markClassName = "size-8 shrink-0",
  wordmarkClassName = "font-serif text-2xl tracking-tight",
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className={markClassName} />
      <span className={wordmarkClassName}>Audiobooker</span>
    </span>
  );
}
