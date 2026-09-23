import Link from "next/link";

const links = [
  { href: "/motion", label: "動くモデル" },
  { href: "/new", label: "新規実行" },
  { href: "/runs", label: "保存した実行" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
        <Link href="/" className="font-semibold tracking-tight">
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
