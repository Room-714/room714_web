import { ChevronRight } from "lucide-react";

export default function PrimaryButton({
  text,
  onClick,
  className = "",
  icon: Icon = ChevronRight,
  isRed = false, // Nueva prop para determinar el estilo
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center
        border-2 rounded-full 
        px-4 py-2 w-fit
        transition-all active:scale-95
        cursor-pointer
        ${
          isRed
            ? "bg-red-600 border-red-600 hover:bg-red-700"
            : "bg-white border-black hover:bg-gray-50"
        }
        ${className}
      `}
    >
      <span
        className={`
        font-title mr-4 text-base font-black uppercase tracking-tighter
        ${isRed ? "text-white" : "text-red-500"}
      `}
      >
        {text}
      </span>

      <div
        className={`
        flex items-center justify-center transition-transform duration-300 ease-in-out text-black group-hover:translate-x-2 shrink-0"
      `}
      >
        <Icon size={24} strokeWidth={2.5} />
      </div>
    </button>
  );
}
