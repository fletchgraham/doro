import { useEffect, useReducer } from "react";
import type Project from "../types/Project";

// Tailwind 400-level colors
export const PROJECT_COLORS = [
  { name: "red", hex: "#f87171" },
  { name: "orange", hex: "#fb923c" },
  { name: "yellow", hex: "#facc15" },
  { name: "green", hex: "#4ade80" },
  { name: "blue", hex: "#60a5fa" },
  { name: "purple", hex: "#c084fc" },
  { name: "gray", hex: "#9ca3af" },
];

const pickColorForProject = (): string => {
  const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
  return color.hex;
};

type ProjectsAction =
  | { type: "ADD_PROJECT"; name: string }
  | { type: "REMOVE_PROJECT"; projectId: string }
  | { type: "UPDATE_PROJECT"; projectId: string; updates: Partial<Project> };

const projectsReducer = (
  state: Project[],
  action: ProjectsAction,
): Project[] => {
  switch (action.type) {
    case "ADD_PROJECT": {
      // Prevent duplicates - reducer is the source of truth
      const exists = state.some(
        (p) => p.name.toLowerCase() === action.name.toLowerCase()
      );
      if (exists) return state;

      const color = pickColorForProject();
      return [
        ...state,
        {
          id: crypto.randomUUID(),
          name: action.name,
          color,
        },
      ];
    }
    case "REMOVE_PROJECT":
      return state.filter((p) => p.id !== action.projectId);
    case "UPDATE_PROJECT":
      return state.map((p) =>
        p.id === action.projectId ? { ...p, ...action.updates } : p,
      );
    default:
      return state;
  }
};

// Deduplicate projects by name (keep first occurrence)
const dedupeProjects = (projects: Project[]): Project[] => {
  const seen = new Set<string>();
  return projects.filter((p) => {
    const key = p.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const useProjects = () => {
  const [projects, dispatch] = useReducer(
    projectsReducer,
    JSON.parse(localStorage.getItem("doroProjects") || "[]"),
    dedupeProjects
  );

  useEffect(() => {
    localStorage.setItem("doroProjects", JSON.stringify(projects));
  }, [projects]);

  const addProject = (name: string): Project => {
    dispatch({ type: "ADD_PROJECT", name });
    // Return the project that will be created (for immediate use)
    const color = pickColorForProject();
    return {
      id: crypto.randomUUID(),
      name,
      color,
    };
  };

  const removeProject = (projectId: string) =>
    dispatch({ type: "REMOVE_PROJECT", projectId });

  const updateProject = (projectId: string, updates: Partial<Project>) =>
    dispatch({ type: "UPDATE_PROJECT", projectId, updates });

  const getProjectById = (projectId: string): Project | undefined =>
    projects.find((p) => p.id === projectId);

  const getOrCreateProject = (name: string): Project => {
    const existing = projects.find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing;

    dispatch({ type: "ADD_PROJECT", name });
    // Return provisional project (actual one created by reducer)
    const color = pickColorForProject();
    return {
      id: crypto.randomUUID(),
      name,
      color,
    };
  };

  return {
    projects,
    addProject,
    removeProject,
    updateProject,
    getProjectById,
    getOrCreateProject,
  };
};

export default useProjects;
