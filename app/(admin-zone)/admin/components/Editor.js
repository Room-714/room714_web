"use client";
import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  List,
  Link as LinkIcon,
  Heading2,
  Quote,
} from "lucide-react";

// Componente interno para los botones del menú
const MenuButton = ({ onClick, isActive, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`p-2 rounded transition-colors ${
      isActive
        ? "bg-red-500 text-white"
        : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 shadow-sm"
    }`}
  >
    {children}
  </button>
);

export default function RichTextEditor({ content, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-red-500 underline cursor-pointer",
        },
      }),
    ],
    content: content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // 2. Sincronizar el contenido cuando cambia desde fuera (al editar)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]); // Se ejecuta cada vez que 'content' cambia en el padre

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Introduce la URL:");
    if (url) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-inner">
      {/* BARRA DE HERRAMIENTAS */}
      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 border-b border-gray-300">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold size={16} strokeWidth={3} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic size={16} strokeWidth={3} />
        </MenuButton>

        <MenuButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
        >
          <Heading2 size={16} strokeWidth={3} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
        >
          <List size={16} strokeWidth={3} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
        >
          <Quote size={16} strokeWidth={3} />
        </MenuButton>

        <MenuButton onClick={addLink} isActive={editor.isActive("link")}>
          <LinkIcon size={16} strokeWidth={3} />
        </MenuButton>
      </div>

      {/* ÁREA DE TEXTO */}
      <div className="bg-white border border-gray-200 rounded-b-xl shadow-inner min-h-[600px]">
        <EditorContent
          editor={editor}
          className="p-10 prose prose-red max-w-none focus:outline-none min-h-[600px] selection:bg-red-100"
        />
      </div>
    </div>
  );
}
