/* Community support links configuration for GitHub Sponsors and Buy Me a Coffee. */

export type SupportLinkId = "github-sponsors" | "buy-me-a-coffee";

export interface SupportLinkEntry {
  id: SupportLinkId;
  label: string;
  tagline: string;
  description: string;
  href: string;
  cta: string;
}

export const supportLinks: SupportLinkEntry[] = [
  {
    id: "github-sponsors",
    label: "GitHub Sponsors",
    tagline: "Monthly or one-time support",
    description:
      "Back ongoing development directly through GitHub Sponsors and help shape what ships next.",
    href: "https://github.com/sponsors/lefos13",
    cta: "Sponsor on GitHub",
  },
  {
    id: "buy-me-a-coffee",
    label: "Buy Me a Coffee",
    tagline: "Quick one-off tip",
    description:
      "No recurring commitment. A coffee helps fund bug fixes, polish, and new workflow features.",
    href: "https://buymeacoffee.com/lefterisev2",
    cta: "Buy me a coffee",
  },
];
