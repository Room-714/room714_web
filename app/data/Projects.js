const PROJECT_META = [
  { id: "01", image: "/project/project-1.png", status: "completed" },
  { id: "02", image: "/project/project-2.png", status: "completed" },
  { id: "03", image: "/project/project-3.png", status: "completed" },
  { id: "04", image: "/project/project-4.png", status: "completed" },
  { id: "05", image: "/project/project-5.png", status: "completed" },
  { id: "06", image: "/project/project-6.png", status: "completed" },
  { id: "07", image: "/project/project-7.png", status: "in_progress" },
  { id: "08", image: "/project/project-8.png", status: "in_progress" },
  { id: "09", image: "/project/project-9.png", status: "in_progress" },
];

export const getProjectsData = (dict) =>
  PROJECT_META.map(({ id, image, status }) => {
    const cs = dict.projects[`case_study_${id}`];
    return {
      id,
      image,
      status,
      title: cs.title,
      challenge: cs.challenge,
      idea: cs.idea,
      outcome: cs.outcome,
    };
  });
