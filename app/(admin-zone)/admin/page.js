"use client";
import { useState, useEffect, useCallback } from "react";
import RichTextEditor from "./components/Editor";
import {
  savePost,
  getPostsList,
  deletePost,
  triggerLinkedInNotification,
} from "./actions";
import Image from "next/image";
import ImageUploader from "./components/ImageUploader";
import { signOut } from "next-auth/react";
import { CATEGORY_IDS, CATEGORY_LABELS } from "@/app/data/BlogCategories";

export default function AdminPage() {
  const [posts, setPosts] = useState([]);
  const [visibleLimit, setVisibleLimit] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [lastSavedPost, setLastSavedPost] = useState(null);

  const [formData, setFormData] = useState({
    id: null,
    date: new Date().toISOString().slice(0, 16),
    published: false,
    category_id: CATEGORY_IDS[0],
    image: "",
    title_es: "",
    tags_es: "",
    content_es: "",
    title_en: "",
    tags_en: "",
    content_en: "",
  });

  const loadPosts = useCallback(async () => {
    try {
      const res = await getPostsList();
      if (res?.success) {
        // El setState ocurre dentro de una promesa (async),
        // lo cual es seguro para React.
        setPosts(res.posts || []);
      }
    } catch (error) {
      console.error("Error al cargar posts:", error);
    }
  }, []); // Importante: Array vacío para que la función sea estable

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      await loadPosts();
    };

    fetchData();

    return () => {
      isMounted = false; // Limpieza para evitar fugas de memoria
    };
  }, [loadPosts]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleEdit = (post) => {
    const es = post.translations?.find((t) => t.lang === "es") || {};
    const en = post.translations?.find((t) => t.lang === "en") || {};
    setFormData({
      id: post.id,
      date: post.date
        ? new Date(post.date).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
      category_id: post.category,
      published: post.published || false,
      image: post.image || "",
      title_es: es.title || "",
      tags_es: es.tags?.join(", ") || "",
      content_es: es.content || "",
      title_en: en.title || "",
      tags_en: en.tags?.join(", ") || "",
      content_en: en.content || "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const result = await savePost(formData);
    if (result.success) {
      setLastSavedPost(result.post);
      setShowModal(true);
      loadPosts();
    }
    setIsSubmitting(false);
  };

  const handleFinalAction = async (options) => {
    const { shouldPublish, linkedIn, scheduleDate } = options;

    const updateData = {
      ...formData,
      id: lastSavedPost.id,
      published: shouldPublish,
      date: scheduleDate,
    };

    const finalResult = await savePost(updateData);

    setShowModal(false);
    if (!formData.id) resetForm();
    loadPosts();
  };

  const resetForm = () =>
    setFormData({
      id: null,
      date: new Date().toISOString().slice(0, 16),
      published: false,
      category_id: CATEGORY_IDS[0],
      image: "",
      title_es: "",
      tags_es: "",
      content_es: "",
      title_en: "",
      tags_en: "",
      content_en: "",
    });

  const currentPosts = posts.slice(0, visibleLimit);
  const hasMore = posts.length > visibleLimit;

  const now = new Date();

  // Filtramos por estado y fecha
  const scheduledPosts = posts.filter(
    (p) => p.published && new Date(p.date) > now,
  );
  const draftPosts = posts.filter((p) => !p.published);
  const livePosts = posts.filter((p) => p.published && new Date(p.date) <= now);

  const renderPostButton = (post, extraClasses = "") => (
    <button
      key={post.id}
      onClick={() => handleEdit(post)}
      className={`w-full text-left p-4 rounded-2xl mb-1 transition-all ${
        formData.id === post.id ? "bg-gray-200 text-black" : "hover:bg-gray-100"
      } ${extraClasses}`}
    >
      <p
        className={`text-xs font-mono mb-1 ${formData.id === post.id ? "text-gray-700" : "text-gray-500"}`}
      >
        {new Date(post.date).toLocaleDateString()}
        {new Date(post.date) > new Date() && post.published && " • 09:00 AM"}
      </p>
      <p className="font-bold text-sm truncate uppercase italic">
        {post.translations?.find((t) => t.lang === "es")?.title || "Sin título"}
      </p>
    </button>
  );

  return (
    // CONTENEDOR PRINCIPAL: Altura fija de pantalla y sin scroll
    <main className="h-screen w-full max-w-400 mx-auto  bg-gray-100 overflow-hidden text-black font-sans flex flex-col p-4 md:p-8">
      {showModal && lastSavedPost && (
        <PublishWorkflowModal
          post={lastSavedPost}
          onClose={() => setShowModal(false)}
          onConfirm={handleFinalAction}
        />
      )}

      <div className="w-full h-full grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden">
        {/* COLUMNA IZQUIERDA: MENÚ FIJO */}
        <div className="lg:col-span-1 flex flex-col h-full overflow-hidden">
          {/* LOGO AREA */}
          <div className="flex-none pl-2">
            <Image
              src="/logo.svg"
              alt="Room714 Logo"
              width={120}
              height={40}
              className="object-contain h-auto w-[50%]"
              priority
            />
          </div>
          <div className="font-hand text-xl text-red-500 text-right">
            Admin Zone
          </div>
          <div className="flex flex-col gap-4 flex-none my-4">
            <button
              onClick={resetForm}
              className="bg-black text-white px-2 py-4 rounded-2xl hover:bg-red-500 font-bold transition-colors uppercase"
            >
              + nuevo post
            </button>
            <h3 className="font-black pl-4 mt-4 text-xl">Publicaciones</h3>
          </div>

          {/* Listado con scroll interno independiente */}
          <div className="flex-1 min-h-0 bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
            <div className="overflow-y-auto flex-1 p-2">
              {/* --- GRUPO 1: PROGRAMADOS --- */}
              {currentPosts.filter(
                (p) => p.published && new Date(p.date) > new Date(),
              ).length > 0 && (
                <div className="mb-6">
                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest pl-2 mb-2 flex items-center">
                    <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2 animate-pulse" />
                    Próximamente (Cron)
                  </p>
                  {currentPosts
                    .filter((p) => p.published && new Date(p.date) > new Date())
                    .map((post) =>
                      renderPostButton(post, "border-l-4 border-blue-500"),
                    )}
                </div>
              )}

              {/* --- GRUPO 2: BORRADORES --- */}
              {currentPosts.filter((p) => !p.published).length > 0 && (
                <div className="mb-6">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-2 mb-2">
                    Borradores
                  </p>
                  {currentPosts
                    .filter((p) => !p.published)
                    .map((post) =>
                      renderPostButton(
                        post,
                        "border-l-4 border-gray-300 opacity-70",
                      ),
                    )}
                </div>
              )}

              {/* --- GRUPO 3: PUBLICADOS (HISTORIAL) --- */}
              <div>
                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest pl-2 mb-2">
                  En vivo (Web & LinkedIn)
                </p>
                {currentPosts
                  .filter((p) => p.published && new Date(p.date) <= new Date())
                  .map((post) =>
                    renderPostButton(post, "border-l-4 border-green-500"),
                  )}
              </div>
            </div>

            {hasMore && (
              <button
                onClick={() => setVisibleLimit((v) => v + 5)}
                className="p-3 text-[10px] font-black uppercase border-t hover:bg-gray-50"
              >
                Cargar más +
              </button>
            )}
          </div>

          <div className="flex-none mt-4">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full py-3 text-[10px] font-bold uppercase border-2 border-black rounded-xl hover:bg-black hover:text-white transition-all"
            >
              Salir ✕
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA: FORMULARIO CON SCROLL */}
        <div className="lg:col-span-3 h-full overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-200 mb-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Sección Categoría e Imagen */}
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Categorías verticales */}
                <div className="space-y-4">
                  <label className="text-lg pl-4 font-black text-gray-400">
                    Categoría
                  </label>
                  <div className="flex flex-col mt-4 gap-2">
                    {" "}
                    {/* Cambiado a flex-col */}
                    {CATEGORY_IDS.map((id) => (
                      <label key={id} className="cursor-pointer w-full">
                        <input
                          type="radio"
                          name="category_id"
                          value={id}
                          checked={formData.category_id === id}
                          onChange={handleChange}
                          className="peer sr-only"
                        />
                        <div className="px-4 py-3 rounded-xl border-2 border-gray-200 bg-white text-sm font-bold transition-all peer-checked:bg-black peer-checked:text-white peer-checked:border-black hover:border-gray-400 text-center md:text-left">
                          {CATEGORY_LABELS[id]?.es || id}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Imagen con tamaño cuadrado reservado */}
                <div className="space-y-4">
                  <label className="text-lg pl-4 font-black text-gray-400">
                    Imagen
                  </label>
                  {/* Contenedor con aspect-ratio fijo */}
                  <div className="w-full aspect-square bg-gray-100 mt-4 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden relative">
                    <ImageUploader
                      currentImage={formData.image}
                      onUploadSuccess={(url) =>
                        setFormData((p) => ({ ...p, image: url }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Editor de Texto */}
              <div className="space-y-12">
                {/* Castellano */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 opacity-30">
                    <span className="w-full h-px bg-black"></span>
                    <span className="text-sm font-bold">ES</span>
                  </div>
                  <input
                    name="title_es"
                    placeholder="Título en español"
                    className="w-full text-3xl font-bold outline-none placeholder:text-gray-200"
                    value={formData.title_es}
                    onChange={handleChange}
                  />
                  <RichTextEditor
                    content={formData.content_es}
                    onChange={(html) =>
                      setFormData((p) => ({ ...p, content_es: html }))
                    }
                  />
                </div>

                {/* Inglés */}
                <div className="space-y-4 pt-8 border-t border-dashed">
                  <div className="flex items-center gap-2 opacity-30">
                    <span className="w-full h-px bg-black"></span>
                    <span className="text-sm font-bold">EN</span>
                  </div>
                  <input
                    name="title_en"
                    placeholder="English title"
                    className="w-full text-3xl font-bold outline-none placeholder:text-gray-200"
                    value={formData.title_en}
                    onChange={handleChange}
                  />
                  <RichTextEditor
                    content={formData.content_en}
                    onChange={(html) =>
                      setFormData((p) => ({ ...p, content_en: html }))
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white font-black py-8 rounded-2xl hover:bg-blue-600 transition-all uppercase tracking-[0.2em] shadow-2xl disabled:bg-gray-400"
              >
                {isSubmitting ? "Procesando..." : "Finalizar Publicación"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}

function PublishWorkflowModal({ post, onClose, onConfirm }) {
  const [linkedIn, setLinkedIn] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  // Calculamos la fecha de mañana como mínimo permitido
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(minDate);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-200 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[40px] p-10 max-w-sm w-full shadow-2xl text-center">
        <h2 className="text-3xl font-black mb-2 text-black">
          {showScheduler ? "Calendario" : "¿Publicamos?"}
        </h2>

        {!showScheduler ? (
          <div className="space-y-3 mt-8">
            <button
              onClick={() =>
                onConfirm({
                  shouldPublish: true,
                  linkedIn,
                  scheduleDate: new Date().toISOString(), // Ahora mismo
                })
              }
              className="w-full bg-black text-white font-black py-5 rounded-2xl hover:scale-[1.02] transition-transform"
            >
              🚀 En Vivo Ahora
            </button>
            <button
              onClick={() => setShowScheduler(true)}
              className="w-full bg-blue-50 text-blue-600 font-black py-5 rounded-2xl hover:bg-blue-100 transition-colors"
            >
              📅 Programar Mañana+
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 p-6 rounded-3xl border-2 border-blue-100 space-y-4">
              <p className="text-[10px] font-black text-blue-600">
                Día de publicación
              </p>
              <input
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 font-bold text-center text-black bg-white"
              />
              <p className="text-[9px] text-gray-400 leading-relaxed">
                * El sistema enviará la notificación a LinkedIn <br />
                el día elegido a las 09:00 AM (Hora Vercel).
              </p>
              <button
                onClick={() =>
                  onConfirm({
                    shouldPublish: true,
                    linkedIn,
                    // Seteamos a las 08:00 AM para asegurar que el Cron de las 09:00 lo vea
                    scheduleDate: new Date(
                      `${selectedDate}T08:00:00`,
                    ).toISOString(),
                  })
                }
                className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-colors"
              >
                Confirmar Fecha
              </button>
            </div>
            <button
              onClick={() => setShowScheduler(false)}
              className="text-[10px] font-bold uppercase text-gray-400 hover:text-black transition-colors"
            >
              ← Volver
            </button>
          </div>
        )}

        <div className="py-6 border-t mt-4 flex items-center justify-between px-2">
          <span className="text-[10px] font-black text-gray-600">
            Notificar en LinkedIn
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={linkedIn}
              onChange={(e) => setLinkedIn(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        <button
          onClick={onClose}
          className="w-full py-4 text-xs font-bold text-gray-300 hover:text-red-500 transition-colors"
        >
          Cancelar todo
        </button>
      </div>
    </div>
  );
}
