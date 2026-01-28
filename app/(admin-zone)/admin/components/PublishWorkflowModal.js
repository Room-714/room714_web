"use client";
import { useState } from "react";

export default function PublishWorkflowModal({ post, onClose, onConfirm }) {
  const [linkedIn, setLinkedIn] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);

  // Calculamos la fecha de mañana como mínimo permitido
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  const [selectedDate, setSelectedDate] = useState(minDate);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-200 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-4xl p-10 max-w-sm w-full shadow-2xl text-center">
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
                  scheduleDate: new Date().toISOString(),
                })
              }
              className="w-full bg-black text-white font-black py-5 rounded-2xl hover:scale-[1.02] transition-transform"
            >
              🚀 Ahora
            </button>
            <button
              onClick={() => setShowScheduler(true)}
              className="w-full bg-blue-50 text-sky-600 font-black py-5 rounded-2xl hover:bg-blue-100 transition-colors"
            >
              📅 Programar
            </button>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="bg-gray-50 p-6 rounded-3xl border-2 border-blue-100 space-y-4">
              <p className="text-sm font-black text-sky-600">
                Día de publicación
              </p>
              <input
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 font-bold text-center text-black bg-white outline-none focus:border-sky-500"
              />
              <p className="text-xs text-gray-400 leading-relaxed text-center">
                * Se publicará automáticamente <br />
                el día elegido a las 09:00 AM.
              </p>
              <button
                onClick={() =>
                  onConfirm({
                    shouldPublish: true,
                    linkedIn,
                    scheduleDate: new Date(
                      `${selectedDate}T08:00:00`,
                    ).toISOString(),
                  })
                }
                className="w-full bg-sky-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-sky-700 transition-colors"
              >
                Confirmar Fecha
              </button>
            </div>
            <button
              onClick={() => setShowScheduler(false)}
              className="text-sm font-bold text-gray-400 hover:text-black transition-colors"
            >
              ← Volver
            </button>
          </div>
        )}

        <div className="py-6 border-t mt-4 flex items-center justify-between px-2">
          <span className="text-sm font-black text-gray-600">
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
