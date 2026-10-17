import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return <Loader2 size={size} className={`animate-spin text-lavender-500 ${className}`} />;
}

export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-lavender-50">
      <Spinner size={40} />
      {message && <p className="text-sm text-lavender-500">{message}</p>}
    </div>
  );
}

export function CardSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner size={32} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-lavender-300">{icon}</div>}
      <p className="text-base font-medium text-lavender-700">{title}</p>
      {description && <p className="mt-1 text-sm text-lavender-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
