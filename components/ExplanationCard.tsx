import React, { useState } from 'react';
import { Card } from './ui/Card';
import { Info, AlertTriangle, CheckCircle, Code, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface ExplanationCardProps {
  title: string;
  children: React.ReactNode;
  type?: 'info' | 'warning' | 'success' | 'technical';
  expandable?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const ExplanationCard: React.FC<ExplanationCardProps> = ({ 
  title, children, type = 'info', expandable, defaultExpanded = false, className 
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !expandable);

  const configs = {
    info: { icon: Info, color: 'text-primary', border: 'border-l-primary' },
    warning: { icon: AlertTriangle, color: 'text-risk-medium', border: 'border-l-risk-medium' },
    success: { icon: CheckCircle, color: 'text-risk-low', border: 'border-l-risk-low' },
    technical: { icon: Code, color: 'text-purple-400', border: 'border-l-purple-500' },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <Card 
      variant="default" 
      padding="none" 
      className={cn('border-l-4', config.border, className)}
    >
      <div 
        className={cn("flex items-center justify-between p-4", expandable && "cursor-pointer hover:bg-slate-800/30 transition-colors")}
        onClick={() => expandable && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <Icon className={config.color} size={20} />
          <h3 className="font-semibold text-slate-200">{title}</h3>
        </div>
        {expandable && (
          <button className="text-slate-500 hover:text-slate-300">
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 pl-11 text-slate-400 text-sm leading-relaxed animate-fade-in">
          {children}
        </div>
      )}
    </Card>
  );
};