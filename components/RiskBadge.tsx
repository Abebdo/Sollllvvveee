import React from 'react';
import { RiskLevel } from '../types';
import { ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
  showIcon?: boolean;
  animate?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className, showIcon = true, animate = false }) => {
  const configs = {
    'Critical': { color: 'text-risk-critical', bg: 'bg-risk-critical/10', border: 'border-risk-critical/30', icon: ShieldAlert, animation: 'animate-heartbeat' },
    'High': { color: 'text-risk-high', bg: 'bg-risk-high/10', border: 'border-risk-high/30', icon: AlertOctagon, animation: '' },
    'Medium': { color: 'text-risk-medium', bg: 'bg-risk-medium/10', border: 'border-risk-medium/30', icon: AlertTriangle, animation: '' },
    'Low': { color: 'text-risk-low', bg: 'bg-risk-low/10', border: 'border-risk-low/30', icon: CheckCircle2, animation: '' },
    'Minimal': { color: 'text-risk-minimal', bg: 'bg-risk-minimal/10', border: 'border-risk-minimal/30', icon: ShieldCheck, animation: '' },
  };

  const config = configs[level];
  const Icon = config.icon;

  return (
    <div className={cn(
      'inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider',
      config.bg,
      config.border,
      config.color,
      animate && config.animation,
      className
    )}>
      {showIcon && <Icon size={14} />}
      {level} Risk
    </div>
  );
};