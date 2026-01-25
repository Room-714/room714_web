"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";
// 1. Cambiamos el nombre de la importación aquí:
import NextImage from "next/image";

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
      // --- Lógica del Canvas para Redimensionar (Mantener igual) ---
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

      // --- NUEVA LÓGICA DE NOMBRE DE ARCHIVO ---
      // Usamos un timestamp para el número secuencial (nn) para evitar colisiones
      const datePrefix = postDate || new Date().toISOString().split("T")[0];
      const seconds = new Date().getSeconds().toString().padStart(2, "0");
      const milliseconds = new Date().getMilliseconds().toString().slice(0, 2);

      // Nombre final: blog/aaaa-mm-dd-nn.jpg
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
    <div className="flex flex-col gap-4 p-4 border-2 border-dashed border-gray-200 rounded-xl bg-white">
      <label className="text-xs font-bold uppercase text-gray-400">
        Imagen del Post (1:1)
      </label>

      {currentImage && (
        <div className="relative w-32 h-32 overflow-hidden rounded-lg shadow-md border border-gray-100">
          {/* 3. Usamos el nuevo nombre del componente aquí */}
          <NextImage
            src={currentImage}
            alt="Preview"
            fill
            className="object-cover"
            sizes="128px"
          />
        </div>
      )}

      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="..."
      />

      {uploading && (
        <p className="text-xs text-orange-500 animate-pulse font-bold text-center">
          Subiendo...
        </p>
      )}
    </div>
  );
}
