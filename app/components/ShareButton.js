"use client";

import { Share2, Check, Copy, X } from "lucide-react";
import { SiLinkedin, SiX, SiWhatsapp } from "react-icons/si";
import { useState } from "react";
import PrimaryButton from "./PrimaryButton";

export default function ShareButton({ title, dict }) {
  const [copied, setCopied] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";

  const handleMainClick = async (e) => {
    if (e) e.preventDefault();

    // 1. MÓVIL: Usamos el menú nativo (Selector del sistema)
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      }
    }

    // 2. ESCRITORIO: Toggle del menú de selección propio
    setShowMenu(!showMenu);
  };

  const shareOps = [
    {
      name: "LinkedIn",
      icon: <SiLinkedin size={20} />,
      link: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      color: "hover:bg-blue-600 hover:text-white text-blue-600",
    },
    {
      name: "X",
      icon: <SiX size={20} />,
      link: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      color: "hover:bg-black hover:text-white text-black",
    },
    {
      name: "WhatsApp",
      icon: <SiWhatsapp size={20} />,
      link: `https://api.whatsapp.com/send?text=${encodeURIComponent(title + " " + url)}`,
      color: "hover:bg-green-500 hover:text-white text-green-600",
    },
  ];

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setShowMenu(false);
      }, 2000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="w-full md:w-2/3 my-10 relative">
      <div onClick={handleMainClick} className="cursor-pointer">
        <PrimaryButton
          text={copied ? dict.copied : dict.share_article}
          icon={copied ? Check : Share2}
          isRed={!copied}
          href="#"
        />
      </div>

      {/* Selector de Redes Sociales */}
      {showMenu && !copied && (
        <div
          className="absolute z-50 
          top-full left-0 mt-3 
          md:top-0 md:right-0 md:left-auto md:mt-0
          
          w-full md:w-[360px] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4
          animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Cabecera con Título y Cruz de Cierre */}
          <div className="flex items-center justify-between mb-4 px-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {dict.share_article}
            </p>
            <button
              onClick={() => setShowMenu(false)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          </div>

          {/* Fila única de 3 columnas */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {shareOps.map((op) => (
              <a
                key={op.name}
                href={op.link}
                target="_blank"
                rel="noopener noreferrer"
                title={op.name}
                className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl transition-all font-bold text-[10px] bg-gray-50 ${op.color} hover:scale-105 shadow-sm border border-transparent hover:border-current`}
              >
                <span className="text-xl">{op.icon}</span>
                <span className="truncate w-full text-center px-1">
                  {op.name}
                </span>
              </a>
            ))}
          </div>

          {/* Botón de copiar extendido */}
          <button
            onClick={copyToClipboard}
            className="w-full flex items-center justify-center gap-3 p-3 rounded-xl transition-all text-sm font-bold bg-gray-100 hover:bg-gray-200 text-gray-600"
          >
            <Copy size={16} />
            <span>{dict.copy_link || "Copiar enlace"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
