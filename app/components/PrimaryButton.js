import { ChevronRight } from "lucide-react";

export default function PrimaryButton({
  text,
  onClick,
  className = "",
  icon: Icon = ChevronRight,
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group flex items-center justify-between
        border-2 border-black rounded-full 
        px-4 py-1 min-w-300px
        bg-white hover:bg-gray-50 transition-all active:scale-95
        cursor-pointer
        ${className}
      `}
    >
      <span className="font-title mr-4 text-lg font-black text-red-500 uppercase tracking-tight">
        {text}
      </span>
      <Icon
        size={24}
        strokeWidth={2.5}
        className="text-black transition-transform duration-300 ease-in-out group-hover:translate-x-2 shrink-0"
      />
    </button>
  );
}
