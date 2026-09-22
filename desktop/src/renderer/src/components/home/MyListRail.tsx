import MediaRail from "../ui/MediaRail";
import { useMyList } from "../../store/myList";

/**
 * "My List" home rail — the user's saved titles, newest first. Renders
 * nothing until at least one title has been saved.
 */
export default function MyListRail() {
  const list = useMyList();
  if (list.length === 0) return null;

  return (
    <MediaRail
      title="My List"
      subtitle="Your saved titles, ready when you are"
      items={list}
    />
  );
}
