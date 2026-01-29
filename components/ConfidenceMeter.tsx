import React from 'react';
import { cn } from '../lib/utils';

interface ConfidenceMeterProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ percentage, size = 'md', className }) => {
  let colorClass = 'bg-risk-critical'; // Red
  if (percentage > 30) colorClass = 'bg-risk-medium'; // Amber
  if (percentage > 60) colorClass = 'bg-primary'; // Cyan

  return (
    <div className={cn('w-full', className)}>
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confidence Score</span>
        <span className={cn(
            "font-bold font-mono", 
            percentage > 60 ? 'text-primary' : percentage > 30 ? 'text-risk-medium' : 'text-risk-critical',
            size === 'lg' ? 'text-2xl' : 'text-lg'
        )}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-1000 ease-out", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};