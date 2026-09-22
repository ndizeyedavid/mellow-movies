export type MediaType = "movie" | "show";

/**
 * App-wide media model. List-level data (home sections, catalogs, search)
 * only fills the basics; the title page merges in the detail payload.
 */
export interface MediaItem {
  /** Route id — the MovieBox slug (detailPath). */
  id: string;
  /** Subject id used by the streaming endpoints. */
  subjectId?: string;
  title: string;
  type: MediaType;
  genre?: string;
  genres?: string[];
  year?: number;
  rating?: string;
  duration?: string;
  durationSeconds?: number;
  quality?: string;
  poster?: string;
  description?: string;
  plot?: string;
  director?: string;
  cast?: string[];
  /** Rich cast entries (portrait + role) when the detail payload has them. */
  castDetailed?: Array<{ name: string; role?: string; avatar?: string }>;
  releaseDate?: string;
  language?: string;
  audio?: string[];
  subtitles?: string[];
  /** Number of seasons for shows. */
  seasons?: string;
  /** Real season → episode layout for shows (from the detail endpoint). */
  seasonMap?: Array<{ se: number; maxEp: number }>;
  hasResource?: boolean;
}

export interface NavLink {
  label: string;
  to: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: "Home", to: "/" },
  { label: "Movie", to: "/movies" },
  { label: "TV Show", to: "/shows" },
  { label: "Animation", to: "/browse" },
];

export const MORE_LINKS: NavLink[] = [
  { label: "Browse All", to: "/browse" },
  { label: "My List", to: "/my-list" },
  { label: "Support", to: "/support" },
];

export const categories: string[] = [
  "Action",
  "Adventure",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Fantasy",
  "Horror",
  "Sci-Fi",
  "Thriller",
];

export interface Faq {
  question: string;
  answer: string;
}

export const faqs: Faq[] = [
  {
    question: "Do I need an account to watch?",
    answer:
      "Nope. Mellow Movies has no signup, no login, and no password to forget. Open the page, press play, enjoy. Your watchlist lives in your browser and nowhere else.",
  },
  {
    question: "Is Mellow Movies really free?",
    answer:
      "Yes, really. There are no subscriptions and no paywalls. If the app has brought you joy, there's a donation button — but it's fully optional, and we won't beg. Much.",
  },
  {
    question: "Why won't a title play, or why does it keep buffering?",
    answer:
      "Streaming depends on your connection and on the source feeding us the content. If a title won't start, try refreshing the page, switching to a more stable network, or checking back a little later.",
  },
  {
    question: "Can I download movies and shows to watch offline?",
    answer:
      "No. Mellow Movies streams — there's no download button and no offline mode. You'll need an internet connection to watch, so make peace with that Wi-Fi bill.",
  },
  {
    question: "What can I watch Mellow Movies on?",
    answer:
      "Anything with a modern browser: PC, laptop, phone, tablet, or smart TV. If it can open a web page, it can probably stream.",
  },
  {
    question: "How does the streaming quality work?",
    answer:
      "Quality adapts automatically to your connection — crisp HD when you can, higher when your bandwidth behaves, and a gentle slide into potato quality when your Wi-Fi gives up.",
  },
  {
    question: "Why did a title disappear from the catalog?",
    answer:
      "Content rotates. Sources change, rights change, and occasionally a title just decides to leave. If something vanishes, it usually comes back — or something better takes its place.",
  },
  {
    question: "Is Mellow Movies legal?",
    answer:
      "We take copyright seriously and honor removal requests through our Request Removal page. If you own something we're showing and want it gone, tell us and we'll take it down. We're not trying to get sued, thanks.",
  },
];

export interface Plan {
  name: string;
  monthly: string;
  yearly: string;
  features: string[];
  highlighted?: boolean;
}

export const plans: Plan[] = [
  {
    name: "Basic",
    monthly: "$9.99",
    yearly: "$7.99",
    features: [
      "HD (720p) resolution",
      "Watch on 1 screen at once",
      "Unlimited movies & shows",
      "Cancel anytime",
    ],
  },
  {
    name: "Standard",
    monthly: "$12.99",
    yearly: "$10.99",
    features: [
      "Full HD (1080p) resolution",
      "Watch on 2 screens at once",
      "Unlimited movies & shows",
      "Download on 2 devices",
      "Cancel anytime",
    ],
    highlighted: true,
  },
  {
    name: "Premium",
    monthly: "$14.99",
    yearly: "$12.99",
    features: [
      "4K Ultra HD + HDR quality",
      "Watch on 4 screens at once",
      "Unlimited movies & shows",
      "Download on 6 devices",
      "Priority support",
      "Cancel anytime",
    ],
  },
];

export interface Device {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const devices: Device[] = [
  {
    id: "smartphones",
    name: "Smartphones",
    description:
      "StreamVibe is optimized for both Android and iOS smartphones. Download our app from the Google Play Store or the Apple App Store.",
    icon: "phone",
  },
  {
    id: "tablets",
    name: "Tablets",
    description:
      "StreamVibe is optimized for both Android and iOS tablets. Download our app from the Google Play Store or the Apple App Store.",
    icon: "tablet",
  },
  {
    id: "tv",
    name: "Smart TVs",
    description:
      "StreamVibe is optimized for both Android and iOS smartphones. Download our app from the Google Play Store or the Apple App Store.",
    icon: "tv",
  },
  {
    id: "laptops",
    name: "Laptops",
    description:
      "StreamVibe is optimized for both Android and iOS smartphones. Download our app from the Google Play Store or the Apple App Store.",
    icon: "laptop",
  },
  {
    id: "consoles",
    name: "Gaming Consoles",
    description:
      "StreamVibe is optimized for both Android and iOS smartphones. Download our app from the Google Play Store or the Apple App Store.",
    icon: "console",
  },
  {
    id: "vr",
    name: "VR Headsets",
    description:
      "StreamVibe is optimized for both Android and iOS smartphones. Download our app from the Google Play Store or the Apple App Store.",
    icon: "vr",
  },
];

export interface FooterLink {
  label: string;
  /** Optional in-app route; decorative links omit it. */
  to?: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export const footerColumns: FooterColumn[] = [
  {
    title: "Home",
    links: [{ label: "Categories" }, { label: "Devices" }, { label: "FAQ" }],
  },
  {
    title: "Movies & Shows",
    links: [
      { label: "All Movies" },
      { label: "All Shows" },
      { label: "New Releases" },
      { label: "Trending" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", to: "/support" },
      { label: "Contact Us", to: "/support" },
      { label: "Terms of Use", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Legal", to: "/removal" },
    ],
  },
  {
    title: "Subscription",
    links: [{ label: "Features" }, { label: "Donate (If you want)" }],
  },
];
