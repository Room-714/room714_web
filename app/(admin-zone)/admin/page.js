"use client";
import { useState, useEffect, useCallback } from "react";
import RichTextEditor from "./components/Editor";
import { savePost, getPostsList, deletePost } from "./actions";
import ImageUploader from "./components/ImageUploader";
import { signOut } from "next-auth/react";

export const CATEGORY_IDS = ["tech", "design", "product", "ux"];

export default function AdminPage() {
  const [posts, setPosts] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    date: new Date().toISOString().split("T")[0],
    category_id: "tech",
    image: "",
    title_es: "",
    tags_es: "",
    content_es: "",
    title_en: "",
    tags_en: "",
    content_en: "",
    publishToLinkedIn: false, // <-- 1. Nuevo campo en el estado
  });

  const loadPosts = useCallback(async () => {
    const res = await getPostsList();
    if (res.success) {
      setPosts(res.posts);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initFetch = async () => {
      await Promise.resolve();
      if (isMounted) {
        loadPosts();
      }
    };
    initFetch();
    return () => {
      isMounted = false;
    };
  }, [loadPosts]);

  // 2. Modificamos handleChange para detectar checkboxes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEdit = (post) => {
    const es = post.translations.find((t) => t.lang === "es") || {};
    const en = post.translations.find((t) => t.lang === "en") || {};

    const catId = CATEGORY_IDS.find(
      (id) => id.toLowerCase() === es.category?.toLowerCase() || id === "tech",
    );

    setFormData({
      id: post.id,
      date: new Date(post.date).toISOString().split("T")[0],
      category_id: catId || "tech",
      image: post.image,
      title_es: es.title || "",
      tags_es: es.tags?.join(", ") || "",
      content_es: es.content || "",
      title_en: en.title || "",
      tags_en: en.tags?.join(", ") || "",
      content_en: en.content || "",
      publishToLinkedIn: false, // Al cargar para editar, lo reseteamos a false por seguridad
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este post?")) {
      const res = await deletePost(id);
      if (res.success) {
        alert("Post eliminado");
        if (formData.id === id) {
          resetForm();
        }
        loadPosts();
      } else {
        alert("Error al eliminar: " + res.error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: null,
      date: new Date().toISOString().split("T")[0],
      category_id: "tech",
      image: "",
      title_es: "",
      tags_es: "",
      content_es: "",
      title_en: "",
      tags_en: "",
      content_en: "",
      publishToLinkedIn: false,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await savePost(formData);

    if (result.success) {
      alert(formData.id ? "¡Post actualizado!" : "¡Post creado!");
      loadPosts();
      if (!formData.id) {
        resetForm();
      }
    } else {
      alert("Error: " + result.error);
    }
  };

  return (
    <main className="min-h-screen bg-gray-100 p-4 md:p-8 text-black font-sans">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* COLUMNA IZQUIERDA: LISTADO */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-title font-black text-xl uppercase tracking-tighter">
              Historial
            </h3>
            <button
              onClick={resetForm}
              className="text-xs bg-black text-white px-2 py-1 rounded hover:bg-red-500 transition-colors"
            >
              Nuevo +
            </button>
          </div>
          {/* BOTÓN DE LOGOUT */}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full py-2 text-[10px] font-bold uppercase tracking-widest border-2 border-black hover:bg-black hover:text-white transition-all rounded-lg"
          >
            Cerrar Sesión ✕
          </button>
          {/* ... (Contenido del listado igual que antes) ... */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-h-[80vh] overflow-y-auto">
            {posts.map((post) => (
              <div
                key={post.id}
                className="relative group border-b last:border-0"
              >
                <button
                  onClick={() => handleEdit(post)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${formData.id === post.id ? "bg-red-50 border-l-4 border-l-red-500" : ""}`}
                >
                  <p className="text-[10px] text-gray-400 font-mono uppercase">
                    {new Date(post.date).toLocaleDateString()}
                  </p>
                  <p className="font-bold text-sm truncate pr-8">
                    {post.translations.find((t) => t.lang === "es")?.title ||
                      "Sin título"}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(post.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO */}
        <div className="lg:col-span-3">
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
            <h2 className="font-title font-black text-3xl mb-8">
              {formData.id ? "Editando Post" : "Nuevo Post"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* CONFIGURACIÓN GLOBAL */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">
                    Categoría Principal
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    className="border p-3 rounded-lg bg-white font-medium outline-none focus:ring-2 focus:ring-black"
                  >
                    {CATEGORY_IDS.map((id) => (
                      <option key={id} value={id}>
                        {id.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">
                    Fecha
                  </label>
                  <input
                    name="date"
                    type="date"
                    className="border p-3 rounded-lg"
                    value={formData.date}
                    onChange={handleChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <ImageUploader
                    currentImage={formData.image}
                    postDate={formData.date}
                    onUploadSuccess={(url) =>
                      setFormData((prev) => ({ ...prev, image: url }))
                    }
                  />
                </div>
              </div>

              {/* SECCIÓN ESPAÑOL E INGLÉS ... (Mantener igual) */}
              <div className="bg-red-50/30 p-6 rounded-xl border border-red-100 space-y-4">
                <h3 className="text-red-600 font-bold uppercase text-xs tracking-widest">
                  Castellano
                </h3>
                <input
                  name="title_es"
                  placeholder="Título ES"
                  className="w-full border p-4 rounded-lg text-xl font-bold"
                  value={formData.title_es}
                  onChange={handleChange}
                />
                <input
                  name="tags_es"
                  placeholder="tags, separados, por, coma"
                  className="w-full border p-3 rounded-lg text-sm"
                  value={formData.tags_es}
                  onChange={handleChange}
                />
                <RichTextEditor
                  content={formData.content_es}
                  onChange={(html) =>
                    setFormData((prev) => ({ ...prev, content_es: html }))
                  }
                />
              </div>

              <div className="bg-blue-50/30 p-6 rounded-xl border border-blue-100 space-y-4">
                <h3 className="text-blue-600 font-bold uppercase text-xs tracking-widest">
                  English
                </h3>
                <input
                  name="title_en"
                  placeholder="Title EN"
                  className="w-full border p-4 rounded-lg text-xl font-bold"
                  value={formData.title_en}
                  onChange={handleChange}
                />
                <input
                  name="tags_en"
                  placeholder="tags, separated, by, comma"
                  className="w-full border p-3 rounded-lg text-sm"
                  value={formData.tags_en}
                  onChange={handleChange}
                />
                <RichTextEditor
                  content={formData.content_en}
                  onChange={(html) =>
                    setFormData((prev) => ({ ...prev, content_en: html }))
                  }
                />
              </div>

              {/* 3. BLOQUE DE PUBLICACIÓN EN LINKEDIN */}
              <div className="flex items-center gap-4 p-5 bg-blue-600/10 border border-blue-200 rounded-2xl group transition-all hover:bg-blue-600/15">
                <input
                  type="checkbox"
                  id="publishToLinkedIn"
                  name="publishToLinkedIn"
                  checked={formData.publishToLinkedIn}
                  onChange={handleChange}
                  className="w-6 h-6 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label
                  htmlFor="publishToLinkedIn"
                  className="flex flex-col cursor-pointer"
                >
                  <span className="font-bold text-blue-900 leading-none">
                    Publicar en LinkedIn Empresa
                  </span>
                  <span className="text-xs text-blue-700 mt-1">
                    Se enviará el título, imagen y enlace al blog
                    automáticamente.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full bg-black text-white font-title font-black py-5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg uppercase tracking-widest"
              >
                {formData.id ? "Actualizar Post" : "Publicar Post"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
