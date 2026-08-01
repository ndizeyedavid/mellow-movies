import MediaRail from "../ui/MediaRail";
import { useContinueWatching } from "../../store/progress";

/**
 * "Continue Watching" home rail — titles with saved playback progress,
 * newest first, each card showing a thin progress bar and resuming on
 * click. Renders nothing until the user has watched something.
 */
export default function ContinueWatchingRail() {
  const entries = useContinueWatching();
  if (entries.length === 0) return null;

  return (
    <MediaRail
      title="Continue Watching"
      subtitle="Pick up right where you left off"
      items={entries.map((e) => e.item)}
      cardTo={(m) => `/watch/${m.id}`}
      progressFor={(m) => {
        const e = entries.find((x) => x.item.id === m.id);
        if (!e || !e.duration) return undefined;
        return Math.min(e.position / e.duration, 1);
      }}
    />
  );
}
