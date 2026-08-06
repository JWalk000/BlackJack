import Link from "next/link";

type FeaturePageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  cta?: { label: string; href: string };
};

export function FeaturePageShell({
  eyebrow,
  title,
  description,
  children,
  cta,
}: FeaturePageShellProps) {
  return (
    <div>
      <section className="border-b border-line bg-limestone">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <p className="animate-rise text-xs font-medium uppercase tracking-[0.2em] text-sage">
            {eyebrow}
          </p>
          <h1 className="animate-rise-delay-1 mt-4 max-w-3xl font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
            {title}
          </h1>
          <p className="animate-rise-delay-2 mt-5 max-w-2xl text-lg leading-relaxed text-steel">
            {description}
          </p>
          {cta && (
            <Link
              href={cta.href}
              className="animate-rise-delay-3 mt-8 inline-flex bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-forest"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        {children}
      </section>
    </div>
  );
}
