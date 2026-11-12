"use client";

import { ChevronDown, Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { Button, type ButtonVariant } from "./Button";
import { Menu, MenuItem } from "./Overlay";

export type ExportFormat = "csv" | "xlsx" | "pdf";

const OPTIONS: { format: ExportFormat; label: string; icon: React.ReactNode }[] = [
  { format: "pdf", label: "PDF", icon: <FileText /> },
  { format: "xlsx", label: "Excel", icon: <FileSpreadsheet /> },
  { format: "csv", label: "CSV", icon: <Sheet /> },
];

/** One "Export" button that downloads the same data as PDF, Excel or CSV. */
export function ExportMenu({ onExport, loading, disabled, size, variant = "secondary", label = "Export" }: {
  onExport: (format: ExportFormat) => void;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: ButtonVariant;
  label?: string;
}) {
  return (
    <Menu
      label={label}
      width="w-44"
      trigger={(props) => (
        <Button {...props} variant={variant} size={size} disabled={disabled} loading={loading} loadingLabel="Preparing…" leadingIcon={<Download className="h-4 w-4" />} trailingIcon={<ChevronDown className="h-4 w-4" />}>
          {label}
        </Button>
      )}
    >
      {(close: () => void) => (
        <div className="p-1.5">
          {OPTIONS.map((option) => (
            <MenuItem key={option.format} icon={option.icon} onSelect={() => { close(); onExport(option.format); }}>{option.label}</MenuItem>
          ))}
        </div>
      )}
    </Menu>
  );
}
