import React from 'react';
import { cn } from '../lib/utils';

interface ConfidenceMeterProps {
  percentage: number;
  range?: { min: number; max: number; mostLikely?: number; uncertainty?: 'LOW' | 'MEDIUM' | 'HIGH' };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ percentage, range, size = 'md', className }) => {
  let colorClass = 'bg-risk-critical'; // Red
  if (percentage > 30) colorClass = 'bg-risk-medium'; // Amber
  if (percentage > 60) colorClass = 'bg-primary'; // Cyan

  const tooltipText = range
    ? `Confidence Range: ${range.min}% – ${range.max}%\nUncertainty: ${range.uncertainty || 'Unknown'}`
    : undefined;

  return (
    <div className={cn('w-full', className)} title={tooltipText}>
      <div className="flex justify-between items-end mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
             {range?.uncertainty ? `Confidence (${range.uncertainty} Uncertainty)` : 'Confidence'}
        </span>
        <span className={cn(
            "font-bold font-mono", 
            percentage > 60 ? 'text-primary' : percentage > 30 ? 'text-risk-medium' : 'text-risk-critical',
            size === 'lg' ? 'text-2xl' : 'text-lg'
        )}>
          {percentage}%
        </span>
      </div>
      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
        {/* Range Indicator (Visualizing Uncertainty) - Rendered first to be behind if needed, but here we might want it to show the full spread */}
        {range && (
            <div
                className="absolute top-0 h-full bg-slate-600/30 z-0"
                style={{
                    left: `${range.min}%`,
                    width: `${range.max - range.min}%`
                }}
            />
        )}

        {/* Main Bar (Most Likely) - We use this as the primary fill up to the percentage */}
        <div 
          className={cn("h-full transition-all duration-1000 ease-out relative z-10", colorClass)}
          style={{ width: `${percentage}%` }}
        />
      </div>
       {range && (
          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
             <span>{range.min}%</span>
             <span className="text-slate-600">Spread: {range.max - range.min}%</span>
             <span>{range.max}%</span>
          </div>
       )}
    </div>
  );
};
