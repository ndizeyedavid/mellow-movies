import { useEffect } from "react";
import { useNavigation } from "react-router-dom";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

/**
 * Thin wrapper around nprogress that starts when React Router
 * begins a navigation and finishes when it settles.
 */
export default function NavProgress() {
  const navigation = useNavigation();

  useEffect(() => {
    if (navigation.state === "loading") {
      NProgress.start();
    } else if (navigation.state === "idle") {
      NProgress.done();
    }
  }, [navigation.state]);

  // Configure nprogress once
  NProgress.configure({
    showSpinner: false,
    trickleSpeed: 200,
    minimum: 0.15,
    easing: "ease",
    speed: 500,
  });

  return null;
}
