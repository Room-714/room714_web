"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import ContactForm from "@/app/components/ContactForm";

// El formulario de Hablemos dentro de la landing. Al enviarse muestra la
// misma confirmación que Hablemos ("¡Hecho!"), pero en su sitio: aquí no
// sustituye a toda la página. Va sobre fondo blanco.
export default function FormularioLanding({ dict }) {
  const [enviado, setEnviado] = useState(false);
  const t = dict.contact.success;

  if (enviado) {
    return (
      <div className="flex flex-col items-start" role="status">
        <CheckCircle2 size={60} className="text-red-600 mb-8" />
        <p className="font-hand text-5xl sm:text-6xl md:text-7xl mb-4 text-black leading-[1.45]">
          {t.title}
        </p>
        <p className="font-body text-xl sm:text-2xl md:text-3xl text-gray-600 max-w-2xl">
          {t.description}
        </p>
      </div>
    );
  }

  return (
    <ContactForm
      dict={dict}
      variante="incorporarIa"
      claro
      onEnviado={() => setEnviado(true)}
    />
  );
}
