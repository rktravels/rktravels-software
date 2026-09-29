"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface OffCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function OffCanvas({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
}: OffCanvasProps) {
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over panel on the right side */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-slate-200 shadow-2xl flex flex-col transform transition-transform duration-200 ease-in-out">
          {/* Header */}
          <div className="h-14 px-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
            <div>
              <h3 className="text-xs sm:text-sm font-medium text-slate-900 leading-none">
                {title}
              </h3>
              {subtitle && (
                <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-[34px] max-h-[34px] w-[34px] flex items-center justify-center rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              aria-label="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
