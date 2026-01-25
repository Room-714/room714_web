"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SessionWrapper from "@/app/components/SessionWrapper"; // 1. Importas el wrapper

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username: e.target.username.value,
      password: e.target.password.value,
      redirect: false,
    });

    if (res?.error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  };

  return (
    <SessionWrapper>
      {" "}
      {/* 2. Envuelves TODO el JSX */}
      <div className="min-h-screen flex items-center justify-center bg-gray-300 px-4">
        <div className="w-full max-w-md bg-white p-10 rounded-[40px] shadow-2xl border-b-8 border-r-8 border-black">
          <h1 className="text-4xl font-black mb-8 uppercase tracking-tighter">
            Admin Login
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              name="username"
              type="text"
              placeholder="USUARIO"
              className="w-full px-6 py-4 bg-gray-100 rounded-2xl outline-none border-2 border-transparent focus:border-black transition-all"
              required
            />
            <input
              name="password"
              type="password"
              placeholder="CONTRASEÑA"
              className="w-full px-6 py-4 bg-gray-100 rounded-2xl outline-none border-2 border-transparent focus:border-black transition-all"
              required
            />

            {error && <p className="text-red-600 font-bold text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:bg-red-600 transition-all"
            >
              {loading ? "ENTRANDO..." : "ENTRAR"}
            </button>
          </form>
        </div>
      </div>
    </SessionWrapper>
  );
}
