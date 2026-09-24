import YouTubeCard from "../ui/YouTubeCard";
import { useMyList } from "../../store/myList";

export default function MyListRail() {
  const list = useMyList();
  if (list.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 px-6 lg:px-8 xl:px-10">
      <div>
        <h2 className="text-xl font-bold text-white lg:text-2xl">My List</h2>
        <p className="text-sm text-muted">
          Your saved titles, ready when you are
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((item) => (
          <YouTubeCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
