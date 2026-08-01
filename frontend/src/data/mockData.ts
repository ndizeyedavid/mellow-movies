import poster1 from "../assets/carousel-1.png";
import poster2 from "../assets/carousel-2.png";
import poster3 from "../assets/carousel-3.png";
import poster4 from "../assets/carousel-4.png";

export type MediaType = "movie" | "show";

export interface MediaItem {
  id: string;
  title: string;
  genre: string;
  genres: string[];
  year: number;
  rating: string;
  duration?: string;
  quality?: string;
  poster: string;
  description: string;
  type: MediaType;
  director: string;
  cast: string[];
  releaseDate: string;
  language: string;
  audio: string[];
  subtitles: string[];
  plot: string;
  seasons?: string;
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
  { label: "Support", to: "/support" },
  { label: "Subscriptions", to: "/pricing" },
];

export const POSTERS = [poster1, poster2, poster3, poster4];

const movieTitles: Array<[string, string, number, string, string, string]> = [
  ["Inception", "Sci-Fi · Action", 2010, "8.8", "2h 28m", "4K"],
  ["Interstellar", "Sci-Fi · Drama", 2014, "8.7", "2h 49m", "4K"],
  ["The Dark Knight", "Action · Crime", 2008, "9.0", "2h 32m", "4K"],
  ["Dune: Part Two", "Sci-Fi · Adventure", 2024, "8.5", "2h 46m", "4K"],
  ["Oppenheimer", "Biography · Drama", 2023, "8.3", "3h 00m", "4K"],
  ["The Batman", "Action · Crime", 2022, "7.8", "2h 56m", "4K"],
  ["Top Gun: Maverick", "Action · Drama", 2022, "8.2", "2h 10m", "4K"],
  [
    "Avatar: The Way of Water",
    "Sci-Fi · Adventure",
    2022,
    "7.6",
    "3h 12m",
    "4K",
  ],
];

const showTitles: Array<[string, string, number, string, string, string]> = [
  ["Stranger Things", "Sci-Fi · Horror", 2016, "8.6", "5 Seasons", "4K"],
  ["Breaking Bad", "Crime · Drama", 2008, "9.5", "5 Seasons", "HD"],
  ["The Crown", "Biography · Drama", 2016, "8.6", "6 Seasons", "4K"],
  ["The Witcher", "Fantasy · Action", 2019, "8.0", "3 Seasons", "4K"],
  ["Money Heist", "Crime · Thriller", 2017, "8.2", "5 Seasons", "HD"],
  ["Squid Game", "Thriller · Drama", 2021, "8.0", "2 Seasons", "HD"],
  ["The Last of Us", "Action · Drama", 2023, "8.7", "1 Season", "4K"],
  ["Wednesday", "Comedy · Fantasy", 2022, "8.1", "1 Season", "4K"],
];

const descriptions = [
  "A mind-bending journey that keeps you on the edge of your seat from start to finish.",
  "An epic story of survival, love and humanity that redefines the genre.",
  "Critically acclaimed masterpiece with unforgettable performances and direction.",
  "A cinematic spectacle with breathtaking visuals and a gripping narrative.",
];

const plots = [
  "When a mysterious phenomenon upends the lives of everyone it touches, an unlikely hero must piece together the truth before it is lost forever. With stunning visuals and a pulse-pounding score, this is a story about memory, choice and the courage to let go.",
  "Years after the events that changed their world, a family must reunite to face a threat that spans galaxies. A sweeping, emotional epic about sacrifice, hope and the ties that bind us together.",
  "A quiet town, a sudden disappearance and a truth buried for decades. As the investigation deepens, the line between reality and nightmare begins to blur in this edge-of-your-seat thriller.",
  "In a world on the brink, one person dares to dream bigger than anyone thought possible. A soaring, character-driven story full of heart, humor and unforgettable moments.",
];

const directors = [
  "Christopher Nolan",
  "Denis Villeneuve",
  "Greta Gerwig",
  "David Fincher",
  "Ridley Scott",
  "Christopher McQuarrie",
  "Taika Waititi",
  "James Cameron",
];

const castPool = [
  "Leonardo DiCaprio",
  "Saoirse Ronan",
  "Timothée Chalamet",
  "Zendaya",
  "Robert Pattinson",
  "Margot Robbie",
  "Jenna Ortega",
  "Pedro Pascal",
  "Millie Bobby Brown",
  "Finn Wolfhard",
  "Bryan Cranston",
  "Aaron Paul",
  "Anya Taylor-Joy",
  "Tom Hardy",
  "Viola Davis",
  "Idris Elba",
];

const languages = [
  "English",
  "English",
  "English",
  "Korean",
  "Spanish",
  "French",
];

const audioSets = [
  ["English", "Hindi", "Spanish"],
  ["English", "French", "German"],
  ["English", "Spanish", "Portuguese"],
  ["English", "Hindi", "Arabic"],
];

const subtitleSets = [
  ["English", "French", "German", "Spanish", "Portuguese"],
  ["English", "Arabic", "Hindi", "Spanish"],
  ["English", "Chinese", "Japanese", "Korean"],
  ["English", "French", "Italian", "Dutch"],
];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const castFor = (i: number) => [
  castPool[i % castPool.length],
  castPool[(i + 3) % castPool.length],
  castPool[(i + 5) % castPool.length],
  castPool[(i + 7) % castPool.length],
];

type MediaBase = Pick<
  MediaItem,
  | "id"
  | "title"
  | "genre"
  | "year"
  | "rating"
  | "duration"
  | "quality"
  | "poster"
  | "description"
  | "type"
>;

const metaFor = (base: MediaBase, i: number): MediaItem => ({
  ...base,
  genres: base.genre.split(" · "),
  director: directors[i % directors.length],
  cast: castFor(i),
  releaseDate: `${months[i % months.length]} ${10 + (i % 20)}, ${base.year}`,
  language: languages[i % languages.length],
  audio: audioSets[i % audioSets.length],
  subtitles: subtitleSets[i % subtitleSets.length],
  plot: plots[i % plots.length],
  seasons: base.type === "show" ? base.duration : undefined,
});

const pickDescription = (i: number) => descriptions[i % descriptions.length];

export const movies: MediaItem[] = movieTitles.map(
  ([title, genre, year, rating, duration, quality], i) =>
    metaFor(
      {
        id: `movie-${i + 1}`,
        title,
        genre,
        year,
        rating,
        duration,
        quality,
        poster: POSTERS[i % POSTERS.length],
        description: pickDescription(i),
        type: "movie",
      },
      i,
    ),
);

export const shows: MediaItem[] = showTitles.map(
  ([title, genre, year, rating, duration, quality], i) =>
    metaFor(
      {
        id: `show-${i + 1}`,
        title,
        genre,
        year,
        rating,
        duration,
        quality,
        poster: POSTERS[i % POSTERS.length],
        description: pickDescription(i),
        type: "show",
      },
      i,
    ),
);

export const trending = [...movies.slice(0, 4), ...shows.slice(0, 4)];

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
    question: "How many screens can I watch Mellow Movies on at once?",
    answer:
      "Every subscription includes unlimited screens. Watch on any device — smart TV, laptop, tablet or phone — at the same time, wherever you are.",
  },
  {
    question: "Can I download movies and shows to watch offline?",
    answer:
      "Yes. All premium plans let you download titles to your device so you can keep watching even without an internet connection.",
  },
  {
    question: "What content is available on Mellow Movies?",
    answer:
      "We offer thousands of blockbuster movies, classic films and popular TV shows, including Mellow Movies Originals produced exclusively for our platform.",
  },
  {
    question: "Is there a free trial available?",
    answer:
      "Yes — every new member gets a free trial period on any plan. Cancel anytime before the trial ends and you will not be charged.",
  },
  {
    question: "Can I change or cancel my subscription anytime?",
    answer:
      "Absolutely. Upgrade, downgrade or cancel your plan at any moment from your account settings. No hidden fees, no long-term contracts.",
  },
  {
    question: "How does the HD and 4K streaming quality work?",
    answer:
      "Standard plans stream in HD, while Premium unlocks 4K Ultra HD with HDR on supported devices — automatically adjusted to your connection speed.",
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

export interface FooterColumn {
  title: string;
  links: string[];
}

export const footerColumns: FooterColumn[] = [
  { title: "Home", links: ["Categories", "Devices", "Pricing", "FAQ"] },
  {
    title: "Movies & Shows",
    links: ["All Movies", "All Shows", "New Releases", "Trending"],
  },
  {
    title: "Support",
    links: [
      "Help Center",
      "Contact Us",
      "Terms of Use",
      "Privacy Policy",
      "Legal",
    ],
  },
  { title: "Subscription", links: ["Plans", "Features", "Free Trial"] },
];
