"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { useId, type ReactNode } from "react";

type LoadingModalProps = {
  open: boolean;
  title: string;
  description?: string;
};

type FormLoadingModalProps = {
  title: string;
  description?: string;
};

type PendingSubmitButtonProps = {
  children: ReactNode;
  pendingChildren?: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function LoadingModal({ open, title, description }: LoadingModalProps) {
  const titleId = useId();

  if (!open) return null;

  return (
    <div className="modal modal-open" role="alertdialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="modal-box max-w-sm text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--app-blue)]/10 text-[var(--app-blue)]">
          <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin" />
        </div>
        <h2 id={titleId} className="mt-4 text-lg font-bold">
          {title}
        </h2>
        {description && <p className="mt-2 text-sm text-base-content/60">{description}</p>}
      </div>
    </div>
  );
}

export function FormLoadingModal({ title, description }: FormLoadingModalProps) {
  const { pending } = useFormStatus();
  return <LoadingModal open={pending} title={title} description={description} />;
}

export function PendingSubmitButton({
  children,
  pendingChildren,
  className = "btn btn-primary gap-2",
  disabled = false
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={disabled || pending}>
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {pendingChildren ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
