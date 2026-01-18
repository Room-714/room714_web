"use client";
import { useState } from "react";
import ProjectCard from "./ProjectCard";

export default function ProjectsList({ projects, dict }) {
  // Inicializamos con el primer ID del array
  const [openId, setOpenId] = useState(projects[0]?.id);

  return (
    <div className="w-full flex flex-col py-10">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          dict={dict}
          isOpen={openId === project.id}
          onClick={() => setOpenId(project.id)}
        />
      ))}
    </div>
  );
}
