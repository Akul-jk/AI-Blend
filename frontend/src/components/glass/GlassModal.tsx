import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import GlassCard from './GlassCard';

interface GlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

const GlassModal: React.FC<GlassModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'md' }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    focusable()?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key === 'Tab') {
        const items = focusable();
        if (!items?.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
        if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previouslyFocused?.focus?.(); };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              role="dialog"
              ref={dialogRef}
              tabIndex={-1}
              aria-modal="true"
              aria-labelledby={title ? 'glass-modal-title' : undefined}
              className={`w-full ${maxWidthClasses[maxWidth]} pointer-events-auto`}
            >
              <GlassCard level="elevated" className="flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                  {title && <h2 id="glass-modal-title" className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>}
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="p-2 -mr-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-subtle)] rounded-full transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
                  {children}
                </div>
              </GlassCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GlassModal;
