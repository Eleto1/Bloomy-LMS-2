// ─────────────────────────────────────────────────────────────────────────────
// RICH TEXT EDITOR — Bulletproof version (zero risky lucide-react imports)
// ─────────────────────────────────────────────────────────────────────────────
// Required npm packages (install ALL of these):
//   npm i @tiptap/react @tiptap/starter-kit @tiptap/extension-underline
//         @tiptap/extension-text-align @tiptap/extension-table
//         @tiptap/extension-table-row @tiptap/extension-table-cell
//         @tiptap/extension-table-header @tiptap/extension-link
//         @tiptap/extension-placeholder @tiptap/extension-image
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { Placeholder } from '@tiptap/extension-placeholder';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOLBAR BUTTON (styled text-based — zero icon import risk)
// ─────────────────────────────────────────────────────────────────────────────
function ToolbarBtn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors text-xs ${
        active
          ? 'bg-indigo-100 text-indigo-700 shadow-sm'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 mx-1" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE ACTION MENU
// ─────────────────────────────────────────────────────────────────────────────
function TableMenu({ editor }: { editor: any }) {
  const [open, setOpen] = React.useState(false);

  const addRowBefore = () => { editor.chain().focus().addRowBefore().run(); setOpen(false); };
  const addRowAfter  = () => { editor.chain().focus().addRowAfter().run(); setOpen(false); };
  const deleteRow    = () => { editor.chain().focus().deleteRow().run(); setOpen(false); };
  const addColBefore = () => { editor.chain().focus().addColumnBefore().run(); setOpen(false); };
  const addColAfter  = () => { editor.chain().focus().addColumnAfter().run(); setOpen(false); };
  const deleteCol    = () => { editor.chain().focus().deleteColumn().run(); setOpen(false); };
  const deleteTable  = () => { editor.chain().focus().deleteTable().run(); setOpen(false); };
  const mergeCells   = () => { editor.chain().focus().mergeCells().run(); setOpen(false); };
  const splitCell    = () => { editor.chain().focus().splitCell().run(); setOpen(false); };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        title="Table options"
        className="p-1.5 rounded-md transition-colors text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
      >
        <span className="font-bold text-sm leading-none">⊞</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px]">
            <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rows</p>
            <button onClick={addRowBefore} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Add row before</button>
            <button onClick={addRowAfter}  className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Add row after</button>
            <button onClick={deleteRow}    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">Delete row</button>
            <div className="border-t my-1" />
            <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Columns</p>
            <button onClick={addColBefore} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Add column before</button>
            <button onClick={addColAfter}  className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Add column after</button>
            <button onClick={deleteCol}    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50">Delete column</button>
            <div className="border-t my-1" />
            <p className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cells</p>
            <button onClick={mergeCells} className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Merge cells</button>
            <button onClick={splitCell}  className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Split cell</button>
            <div className="border-t my-1" />
            <button onClick={deleteTable} className="w-full text-left px-3 py-1.5 text-xs text-red-600 font-medium hover:bg-red-50">Delete table</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINK INSERT POPUP
// ─────────────────────────────────────────────────────────────────────────────
function LinkPopup({ editor, onSetLink }: { editor: any; onSetLink: (url: string) => void }) {
  const [showInput, setShowInput] = React.useState(false);
  const [url, setUrl] = React.useState('');

  const handleSave = () => {
    if (url.trim()) {
      onSetLink(url.trim());
      setUrl('');
      setShowInput(false);
    }
  };

  return (
    <div className="relative">
      {!showInput ? (
        <>
          <ToolbarBtn
            active={editor.isActive('link')}
            onClick={() => {
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowInput(true);
              }
            }}
            title="Insert/edit link"
          >
            <span className="font-bold text-sm">🔗</span>
          </ToolbarBtn>
          {editor.isActive('link') && (
            <ToolbarBtn onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">
              <span className="text-xs font-bold">✕</span>
            </ToolbarBtn>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowInput(false); }}
            placeholder="https://..."
            className="w-40 text-xs outline-none bg-transparent"
            autoFocus
          />
          <button onClick={handleSave} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-1">OK</button>
          <button onClick={() => setShowInput(false)} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE INSERT
// ─────────────────────────────────────────────────────────────────────────────
function ImageInsert({ onInsertImage }: { onInsertImage: (url: string) => void }) {
  const [showInput, setShowInput] = React.useState(false);
  const [url, setUrl] = React.useState('');

  const handleSave = () => {
    if (url.trim()) {
      onInsertImage(url.trim());
      setUrl('');
      setShowInput(false);
    }
  };

  return (
    <div className="relative">
      {!showInput ? (
        <ToolbarBtn onClick={() => setShowInput(true)} title="Insert image">
          <span className="text-sm">🖼</span>
        </ToolbarBtn>
      ) : (
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowInput(false); }}
            placeholder="Image URL..."
            className="w-40 text-xs outline-none bg-transparent"
            autoFocus
          />
          <button onClick={handleSave} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold px-1">OK</button>
          <button onClick={() => setShowInput(false)} className="text-gray-400 hover:text-gray-600 text-xs px-1">✕</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  className = '',
  minHeight = '200px',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse border border-gray-300 w-full',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 min-w-[100px]',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 p-2 bg-gray-100 font-bold text-left',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-indigo-600 underline hover:text-indigo-800' },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-3 py-2',
      },
    },
  });

  // Keep editor in sync if content changes externally
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', false);
    }
  }, [content, editor]);

  const setLink = useCallback(
    (url: string) => {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    },
    [editor]
  );

  const insertImage = useCallback(
    (url: string) => {
      editor?.chain().focus().setImage({ src: url }).run();
    },
    [editor]
  );

  if (!editor) return null;

  const insertTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white ${className}`}>
      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200 sticky top-0 z-30">
        {/* Undo / Redo */}
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <span className="text-sm font-bold">↩</span>
        </ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <span className="text-sm font-bold">↪</span>
        </ToolbarBtn>

        <Divider />

        {/* Text Type */}
        <ToolbarBtn
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          <span className="text-xs font-bold leading-none">H1</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          <span className="text-xs font-bold leading-none">H2</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3"
        >
          <span className="text-xs font-bold leading-none">H3</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={!editor.isActive('heading')}
          onClick={() => editor.chain().focus().setParagraph().run()}
          title="Paragraph"
        >
          <span className="text-xs font-bold">¶</span>
        </ToolbarBtn>

        <Divider />

        {/* Formatting */}
        <ToolbarBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <span className="text-xs font-black">B</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <span className="text-xs italic font-serif font-bold">I</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <span className="text-xs font-bold underline">U</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <span className="text-xs font-bold line-through">S</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          <span className="text-xs font-mono font-bold">&lt;/&gt;</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          <span className="text-xs font-bold">&ldquo;</span>
        </ToolbarBtn>

        <Divider />

        {/* Lists */}
        <ToolbarBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          <span className="text-xs font-bold">&bull;</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          <span className="text-xs font-bold">1.</span>
        </ToolbarBtn>

        <Divider />

        {/* Alignment */}
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          title="Align left"
        >
          <span className="text-xs font-bold">≡&larr;</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          title="Align center"
        >
          <span className="text-xs font-bold">≡</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          title="Align right"
        >
          <span className="text-xs font-bold">&rarr;≡</span>
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: 'justify' })}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          title="Justify"
        >
          <span className="text-xs font-bold">≡≡</span>
        </ToolbarBtn>

        <Divider />

        {/* Insert */}
        <LinkPopup editor={editor} onSetLink={setLink} />
        <ImageInsert onInsertImage={insertImage} />
        <ToolbarBtn onClick={insertTable} title="Insert table (3×3)">
          <span className="font-bold text-sm leading-none">⊞</span>
        </ToolbarBtn>
        <TableMenu editor={editor} />
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal line">
          <span className="text-sm font-bold">&mdash;</span>
        </ToolbarBtn>

        {/* Code block */}
        <ToolbarBtn
          active={editor.isActive('codeBlock')}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          title="Code block"
        >
          <span className="text-xs font-mono font-bold">{'{ }'}</span>
        </ToolbarBtn>
      </div>

      {/* ── Editor Content ──────────────────────────────────────── */}
      <div style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>

      {/* ── Editor Styles ────────────────────────────────────────── */}
      <style>{`
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          overflow: hidden;
          border-radius: 4px;
        }
        .ProseMirror td,
        .ProseMirror th {
          border: 1px solid #d1d5db;
          padding: 8px 12px;
          min-width: 80px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .ProseMirror th {
          background: #f3f4f6;
          font-weight: 600;
          text-align: left;
        }
        .ProseMirror td.selectedCell,
        .ProseMirror th.selectedCell {
          background: #e0e7ff;
        }
        .ProseMirror .tableWrapper {
          overflow-x: auto;
          margin: 1em 0;
        }
        .ProseMirror .resize-cursor {
          cursor: col-resize;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 0.5em 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #6366f1;
          padding-left: 1em;
          margin-left: 0;
          color: #4b5563;
          font-style: italic;
        }
        .ProseMirror pre {
          background: #1e1e2e;
          color: #cdd6f4;
          padding: 1em;
          border-radius: 8px;
          font-family: 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.85em;
          overflow-x: auto;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5em 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
        }
        .ProseMirror a {
          color: #4f46e5;
          text-decoration: underline;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          color: #3730a3;
        }
      `}</style>
    </div>
  );
}
