import { useEffect, useState } from "react";
import { FaArrowUp } from "react-icons/fa6";

/**
 * Floating "back to top" button — appears after scrolling past 400px,
 * smooth-scrolls to the top on click. Hidden on small screens.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`fixed bottom-6 right-6 z-40 hidden h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-white shadow-2xl shadow-black/40 transition-all duration-300 hover:border-line2 hover:bg-card2 sm:flex ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <FaArrowUp className="h-5 w-5" />
    </button>
  );
}
