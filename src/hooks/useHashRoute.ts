import { useEffect, useState } from "react";

// Pages are addressed by hash so the timer keeps running (App never
// unmounts) and the projects page has a URL you can bookmark.
export type Route = "timer" | "projects";

export const routeHash: Record<Route, string> = {
  timer: "#/",
  projects: "#/projects",
};

const parseRoute = (hash: string): Route =>
  hash.replace(/^#\/?/, "").split("/")[0] === "projects" ? "projects" : "timer";

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
