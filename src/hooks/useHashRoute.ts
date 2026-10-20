import { useEffect, useState } from "react";

// Pages are addressed by hash so the timer keeps running (App never
// unmounts) and the other pages have URLs you can bookmark.
// "timer" is the Day page, home of the countdown.
export type Route = "timer" | "week" | "projects" | "archive" | "templates";

export const routeHash: Record<Route, string> = {
  timer: "#/",
  week: "#/week",
  projects: "#/projects",
  archive: "#/archive",
  templates: "#/templates",
};

const parseRoute = (hash: string): Route => {
  const page = hash.replace(/^#\/?/, "").split("/")[0];
  if (page === "week") return "week";
  if (page === "projects") return "projects";
  if (page === "archive") return "archive";
  if (page === "templates") return "templates";
  return "timer";
};

export default function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.hash)
  );

  useEffect(() => {
    const onChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return route;
}
