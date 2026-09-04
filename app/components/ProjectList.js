"use client";
import { useState } from "react";
import ProjectCard from "./ProjectCard";

export default function ProjectsList({ projects, dict, desde = 0 }) {
  // Inicializamos con el primer ID del array
  const [openId, setOpenId] = useState(projects[0]?.id);

  return (
    <div className="w-full flex flex-col py-2">
      {projects.map((project, index) => (
        <ProjectCard
          key={project.id}
          project={project}
          dict={dict}
          isOpen={openId === project.id}
          onClick={() => setOpenId(project.id)}
          priority={index === 0}
          numero={String(desde + index + 1).padStart(2, "0")}
        />
      ))}
    </div>
  );
}
