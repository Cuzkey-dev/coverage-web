import Link from "next/link";

const links = [
  { href: "/motion", label: "動くモデル" },
  { href: "/new", label: "新規実行" },
  { href: "/runs", label: "保存した実行" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 font-semibold tracking-tight"
        >
          <svg
            viewBox="0 0 24 24"
            width="25"
            height="25"
            fill="currentColor"
            className="text-[#326b70]"
            aria-hidden="true"
          >
            <circle cx="4" cy="6" r="2" />
            <circle cx="12" cy="3" r="2" />
            <circle cx="20" cy="6" r="2" />
            <circle cx="4" cy="15" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="20" cy="15" r="2" />
            <circle cx="12" cy="21" r="2" />
          </svg>
          Coverage Web
        </Link>
        <nav className="flex gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
