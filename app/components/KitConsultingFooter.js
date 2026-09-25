import styles from "./KitConsultingFooter.module.css";

// Publicidad obligatoria del programa Kit Consulting (Manual_ID_KC_V03).
// Va dentro del footer del layout, entre los enlaces legales y el copyright,
// así que sale en todas las páginas de /es y /en.
//
// El SVG es la ristra oficial de Red.es (versión Blanco, para fondo oscuro)
// y no se toca: orden, tamaños relativos y separaciones son los suyos. Cada
// logo es una ventana del mismo archivo (x y ancho en unidades del viewBox de
// 1920×168), para que tenga su propio <img> con su alt y en móvil pueda pasar
// a varias filas. El navegador descarga el archivo una sola vez.
const RISTRA = "/logos-kc/KC_conClaim_conBandera_Blanco.svg";

const LOGOS = [
  { key: "kc", x: 30, w: 422 },
  { key: "ue", x: 797, w: 278 },
  { key: "gob", x: 1116, w: 392 },
  { key: "redes", x: 1512, w: 169 },
  { key: "prtr", x: 1706, w: 192 },
];

const KIT_CONSULTING_URL = "https://www.acelerapyme.gob.es/kit-consulting";

export default function KitConsultingFooter({ dict }) {
  return (
    <section aria-label={dict.aria_label} className={`${styles.band} text-white font-body font-light`}>
      <p className={styles.claim}>
        <a href={KIT_CONSULTING_URL} target="_blank" rel="noopener">
          {dict.text}
        </a>
      </p>
      <ul className={styles.ristra}>
        {LOGOS.map(({ key, x, w }, indice) => (
          <li
            key={key}
            className={indice === 0 ? `${styles.item} ${styles.lead}` : styles.item}
            style={{ "--x": x, "--w": w }}
          >
            {/* <img> y no next/image: el SVG oficial se sirve tal cual. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={RISTRA} alt={dict.alt[key]} loading="lazy" decoding="async" />
          </li>
        ))}
      </ul>
    </section>
  );
}
