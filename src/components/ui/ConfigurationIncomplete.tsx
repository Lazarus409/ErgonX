import { AlertTriangle } from "lucide-react";

interface ConfigurationIncompleteProps {
  blockers: string[];
}

export default function ConfigurationIncomplete({
  blockers,
}: ConfigurationIncompleteProps) {
  if (blockers.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertTriangle
          size={19}
          className="mt-0.5 shrink-0 text-amber-600"
        />

        <div>
          <h3 className="text-sm font-semibold text-amber-900">
            Configuration incomplete
          </h3>

          <p className="mt-1 text-xs text-amber-800">
            Complete the following required items before
            the institution can be marked READY.
          </p>

          <ul className="mt-3 space-y-1">
            {blockers.map((blocker) => (
              <li
                key={blocker}
                className="text-xs text-amber-800"
              >
                • {blocker}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
