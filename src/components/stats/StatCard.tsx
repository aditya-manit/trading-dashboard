'use client';

import { type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StatCardProps {
  title: string;
  value: string;
  subvalue?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  valueColor?: string;
  isLoading?: boolean;
}

export function StatCard({
  title,
  value,
  subvalue,
  icon: Icon,
  iconColor = 'text-indigo-600',
  iconBg = 'bg-indigo-50',
  valueColor = 'text-gray-900',
  isLoading,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3.5 w-20" />
        </div>
      ) : (
        <div>
          <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>{value}</p>
          {subvalue && <p className="text-xs text-gray-400 mt-1">{subvalue}</p>}
        </div>
      )}
    </div>
  );
}
