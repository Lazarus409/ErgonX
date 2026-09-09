export default function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
        <p className="mt-4 text-sm text-slate-500">
          Loading ErgonX...
        </p>
      </div>
    </div>
  );
}
