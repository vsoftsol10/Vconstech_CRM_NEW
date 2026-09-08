import { useEffect, useRef, useState } from "react";
import { FiMoreVertical } from "react-icons/fi";

/**
 * Compact "three dot" actions menu used by both the Marketing table rows
 * and the Marketing ticket cards, so View / Edit / Delete live in one
 * dropdown instead of separate buttons.
 */
const RowActionsMenu = ({ lead, onView, onEdit, onDelete, align = "right" }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (action) => (event) => {
    event.stopPropagation();
    setOpen(false);
    action?.(lead);
  };

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((prev) => !prev);
        }}
        aria-label="Open actions menu"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
      >
        <FiMoreVertical size={16} />
      </button>

      {open && (
        <div
          className={`absolute top-9 z-20 w-32 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <button
            type="button"
            onClick={handleSelect(onView)}
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#C89B00]"
          >
            View
          </button>
          <button
            type="button"
            onClick={handleSelect(onEdit)}
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-yellow-50 hover:text-[#C89B00]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleSelect(onDelete)}
            className="block w-full px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default RowActionsMenu;
