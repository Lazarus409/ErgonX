"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Overlay";
import { cx } from "@/lib/cx";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const Icon = destructive ? AlertTriangle : HelpCircle;
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      dismissible={!loading}
      size="sm"
      title={title}
      description={description}
      icon={
        <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", destructive ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary")} aria-hidden="true">
          <Icon className="h-5 w-5" />
        </span>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
          <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} loading={loading} loadingLabel="Processing…" data-autofocus>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
