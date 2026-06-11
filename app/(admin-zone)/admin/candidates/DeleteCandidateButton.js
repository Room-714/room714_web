"use client";

import { useState, useTransition } from "react";
import { deleteCandidate } from "./actions";

export default function DeleteCandidateButton({ candidateId }) {
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(() => {
      deleteCandidate(candidateId);
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="bg-white border-2 border-red-500 text-red-500 font-black py-4 px-8 rounded-2xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-[0.2em] disabled:opacity-50"
    >
      {isPending
        ? "Borrando…"
        : confirming
          ? "¿Seguro? Pulsa otra vez"
          : "Eliminar CV ahora"}
    </button>
  );
}
