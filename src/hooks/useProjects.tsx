import { useEffect, useReducer } from "react";
import type Project from "../types/Project";

// A curated palette of distinguishable colors for projects
const PROJECT_COLORS = [
  "#e57373", // red
  "#64b5f6", // blue
  "#81c784", // green
  "#ffb74d", // orange
  "#ba68c8", // purple
  "#4db6ac", // teal
  "#f06292", // pink
  "#aed581", // lime
  "#7986cb", // indigo
  "#ffcc80", // peach
];

// TODO(human): Implement this function
const pickColorForProject = (
  projectName: string,
  existingProjects: Project[]
): string => {
  // Your task: decide how to pick a color for a new project.
  // You have access to:
  //   - projectName: the name of the new project being created
  //   - existingProjects: array of already-created projects (each has id, name, color)
  //   - PROJECT_COLORS: the palette array above
  //
  // Return a color string (hex code) for the new project.
  void projectName;
  void existingProjects;
  return PROJECT_COLORS[0]; // placeholder - replace this!
};

type ProjectsAction =
  | { type: "ADD_PROJECT"; name: string }
  | { type: "REMOVE_PROJECT"; projectId: string }
  | { type: "UPDATE_PROJECT"; projectId: string; updates: Partial<Project> };

const projectsReducer = (
  state: Project[],
  action: ProjectsAction
): Project[] => {
  switch (action.type) {
    case "ADD_PROJECT": {
      const color = pickColorForProject(action.name, state);
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
        p.id === action.projectId ? { ...p, ...action.updates } : p
      );
    default:
      return state;
  }
};

const useProjects = () => {
  const [projects, dispatch] = useReducer(
    projectsReducer,
    JSON.parse(localStorage.getItem("doroProjects") || "[]")
  );

  useEffect(() => {
    localStorage.setItem("doroProjects", JSON.stringify(projects));
  }, [projects]);

  const addProject = (name: string): Project => {
    dispatch({ type: "ADD_PROJECT", name });
    // Return the project that will be created (for immediate use)
    const color = pickColorForProject(name, projects);
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
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing;

    dispatch({ type: "ADD_PROJECT", name });
    // Return provisional project (actual one created by reducer)
    const color = pickColorForProject(name, projects);
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
