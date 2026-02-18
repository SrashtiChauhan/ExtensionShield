/**
 * Case studies data for Research > Case Studies.
 * Used for listing, pagination, and correct links to detail pages.
 * SEO: titles and descriptions include keywords people search for
 * (Chrome extension security, malicious extensions, enterprise risk, etc.).
 */
export const CASE_STUDIES_PER_PAGE = 4;

export const caseStudies = [
  {
    id: "honey",
    slug: "honey",
    path: "/research/case-studies/honey",
    title: "Honey Extension Case Study",
    subtitle: "17M+ users reported. $4B acquisition.",
    date: "December 2024",
    category: "Affiliate Fraud",
    severity: "HIGH",
    description:
      "Reported analysis: alleged affiliate link hijacking, shopping behavior tracking, and disputed savings claims. How a highly rated Chrome extension can still pose privacy and trust risks for consumers and enterprises.",
    keywords: ["Chrome extension security", "affiliate fraud", "browser extension privacy", "PayPal Honey"],
    featured: true,
    comingSoon: false,
  },
  {
    id: "pdf-converters",
    slug: "pdf-converters",
    path: "/research/case-studies/pdf-converters",
    title: "PDF Converter Extensions",
    subtitle: "The Hidden Data Harvesting Network",
    date: "2024–2025",
    category: "Data Exfiltration",
    severity: "HIGH",
    description:
      "Analysis of popular PDF converter extensions that harvest document contents and user data. Security research shows networks of malicious extensions using remote configuration to bypass store review—critical for enterprise extension risk management.",
    keywords: ["Chrome extension malware", "PDF extension security", "data harvesting", "extension threat research"],
    featured: false,
    comingSoon: false,
  },
  {
    id: "fake-ad-blockers",
    slug: "fake-ad-blockers",
    path: "/research/case-studies/fake-ad-blockers",
    title: "Fake Ad Blockers",
    subtitle: "Wolves in Sheep's Clothing",
    date: "2021–2025",
    category: "Malware",
    severity: "CRITICAL",
    description:
      "How malicious ad blocker clones inject ads instead of blocking them. Research indicates 20M–80M+ users affected. Essential reading for security teams and anyone evaluating browser extension security before deploy.",
    keywords: ["fake ad blocker", "Chrome extension malware", "ad injection", "malicious extension"],
    featured: false,
    comingSoon: false,
  },
  {
    id: "cryptominers",
    title: "Cryptominer Extensions",
    subtitle: "Background Mining at Your Expense",
    date: "Coming Soon",
    category: "Abuse of Resources",
    severity: "HIGH",
    description:
      "Chrome extensions that silently mine cryptocurrency in the background. How to detect resource abuse and permission misuse in browser extensions—important for enterprise extension governance.",
    keywords: ["cryptominer extension", "Chrome extension abuse", "browser extension security"],
    comingSoon: true,
  },
  {
    id: "password-managers",
    title: "Fake Password Manager Extensions",
    subtitle: "Stealing Credentials in Plain Sight",
    date: "Coming Soon",
    category: "Credential Theft",
    severity: "CRITICAL",
    description:
      "Fake password manager extensions that phish or exfiltrate credentials. Red flags and how security teams can scan extensions for credential theft risk before allowing install.",
    keywords: ["fake password manager", "extension credential theft", "Chrome extension phishing"],
    comingSoon: true,
  },
  {
    id: "vpn-extensions",
    title: "Rogue VPN & Proxy Extensions",
    subtitle: "Traffic Interception and Data Leaks",
    date: "Coming Soon",
    category: "Privacy",
    severity: "HIGH",
    description:
      "VPN and proxy extensions that log or sell user traffic. Why enterprises need to audit extension permissions and network behavior—browser extension security best practices.",
    keywords: ["VPN extension security", "proxy extension risk", "extension traffic interception"],
    comingSoon: true,
  },
];
