import { useState } from "react";
import { FaShareNodes } from "react-icons/fa6";
import Button from "./Button";
import { showToast } from "../../utils/toast";

interface ShareButtonProps {
  /** Title used for the native share sheet and the copy-toast message. */
  title: string;
  /** Defaults to the current page URL. */
  url?: string;
}

type ShareableNavigator = Navigator & {
  share?: (data: {
    title?: string;
    text?: string;
    url: string;
  }) => Promise<void>;
};

/**
 * Share button — uses the OS share sheet on mobile; falls back to copying
 * the link with a toast confirmation on desktop.
 */
export default function ShareButton({ title, url }: ShareButtonProps) {
  const [busy, setBusy] = useState(false);
  const shareUrl = url ?? window.location.href;

  const onShare = async () => {
    if (busy) return;
    const nav = navigator as ShareableNavigator;
    if (nav.share) {
      try {
        await nav.share({ title: `${title} — Mellow Movies`, url: shareUrl });
      } catch {
        // User cancelled the sheet — no feedback needed.
      }
      return;
    }
    setBusy(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Link copied", { message: title });
    } catch {
      showToast("Couldn't copy link", {
        message: "Copy the URL from your browser bar instead.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="lg"
      variant="outline"
      icon={<FaShareNodes className="h-5 w-5" />}
      onClick={onShare}
    >
      Share
    </Button>
  );
}
