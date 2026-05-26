const RULE_META = [
  { id: "01", image: "/rules-01.png" },
  { id: "02", image: "/rules-02.png" },
  { id: "03", image: "/rules-03.png" },
  { id: "04", image: "/rules-04.png" },
];

export const getRules = (dict) =>
  RULE_META.map(({ id, image }) => {
    const r = dict.about.rules[`rule_${parseInt(id, 10)}`];
    return {
      id,
      image,
      title: r.title,
      description_line1: r.description_line1,
      description_line2: r.description_line2,
    };
  });
