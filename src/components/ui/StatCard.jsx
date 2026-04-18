import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';

export function StatCard({
  icon: Icon,
  label,
  value,
  change,
  direction = 'up',
  subtitle,
  className = '',
}) {
  const isPositive = direction === 'up';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const trendColor = isPositive ? 'text-green-600' : 'text-red-600';
  const bgColor = isPositive ? 'bg-green-50' : 'bg-red-50';

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium mb-1">{label}</p>
          <h3 className="text-2xl sm:text-3xl font-bold text-brand-charcoal mb-3">
            {value}
          </h3>

          {change !== undefined && (
            <div className={`flex items-center gap-1 font-semibold ${trendColor}`}>
              <TrendIcon className="w-4 h-4" />
              <span className="text-sm">{change}</span>
            </div>
          )}

          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>

        {Icon && (
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor}`}>
            <Icon className={`w-6 h-6 ${trendColor}`} />
          </div>
        )}
      </div>
    </Card>
  );
}
