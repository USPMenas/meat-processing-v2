import type { ReactNode } from 'react';
import { useState } from 'react';
import { Expand } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface ExpandableChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  detailTitle?: string;
  detailContent?: ReactNode;
}

export function ExpandableChartPanel({
  title,
  subtitle,
  children,
  detailTitle,
  detailContent,
}: ExpandableChartPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasDetail = Boolean(detailContent);

  return (
    <>
      <div
        className={`rounded-xl border border-gray-200 bg-white p-4 ${
          hasDetail ? 'cursor-pointer transition-shadow hover:shadow-md' : ''
        }`}
        onClick={() => {
          if (hasDetail) {
            setIsOpen(true);
          }
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {hasDetail && (
            <button
              type="button"
              aria-label={`Expandir ${title}`}
              className="inline-flex size-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
              onClick={(event) => {
                event.stopPropagation();
                setIsOpen(true);
              }}
            >
              <Expand className="size-4" />
            </button>
          )}
        </div>

        {children}
      </div>

      {hasDetail && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailTitle ?? title}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">{detailContent}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
