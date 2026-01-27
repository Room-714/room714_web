"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
import NextImage from "next/image";
import { UploadCloud, Loader2 } from "lucide-react"; // Importamos los iconos

export default function ImageUploader({
  onUploadSuccess,
  currentImage,
  postDate,
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // --- Lógica del Canvas (Se mantiene igual) ---
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise((resolve) => (img.onload = resolve));
      const canvas = document.createElement("canvas");
      const size = 800;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const sourceSize = Math.min(img.width, img.height);
      const offsetX = (img.width - sourceSize) / 2;
      const offsetY = (img.height - sourceSize) / 2;
      ctx.drawImage(
        img,
        offsetX,
        offsetY,
        sourceSize,
        sourceSize,
        0,
        0,
        size,
        size,
      );
      const blob = await new Promise((res) =>
        canvas.toBlob(res, "image/jpeg", 0.8),
      );

      const datePrefix = postDate || new Date().toISOString().split("T")[0];
      const seconds = new Date().getSeconds().toString().padStart(2, "0");
      const milliseconds = new Date().getMilliseconds().toString().slice(0, 2);
      const fileName = `blog/${datePrefix}-${seconds}${milliseconds}.jpg`;

      const newBlob = await upload(fileName, blob, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });

      onUploadSuccess(newBlob.url);
    } catch (error) {
      console.error("Error:", error);
      alert("Error al subir");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="relative flex flex-col items-center justify-center w-full h-full cursor-pointer group transition-all">
      {/* 1. Imagen de fondo (si existe) */}
      {currentImage && !uploading && (
        <NextImage
          src={currentImage}
          alt="Preview"
          fill
          className="object-cover rounded-2xl"
          sizes="(max-width: 768px) 100vw, 400px"
        />
      )}

      {/* 2. Overlay / Interfaz de usuario */}
      <div
        className={`
        absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 rounded-2xl transition-colors
        ${currentImage ? "bg-black/40 group-hover:bg-black/60" : "bg-white"}
      `}
      >
        {uploading ? (
          <>
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
            <p className="text-xs font-black uppercase text-red-500">
              Subiendo...
            </p>
          </>
        ) : (
          <>
            <UploadCloud
              className={`w-10 h-10 ${currentImage ? "text-white" : "text-gray-300"}`}
            />
            <div className="text-center">
              <p
                className={`text-sm font-black uppercase ${currentImage ? "text-white" : "text-black"}`}
              >
                {currentImage ? "Cambiar Imagen" : "Subir Imagen"}
              </p>
              <p
                className={`text-[10px] uppercase font-bold ${currentImage ? "text-gray-200" : "text-gray-400"}`}
              >
                JPG o PNG (800x800 px)
              </p>
            </div>
          </>
        )}
      </div>

      {/* 3. Input oculto */}
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden" // Escondemos el input feo del sistema
      />
    </label>
  );
}
