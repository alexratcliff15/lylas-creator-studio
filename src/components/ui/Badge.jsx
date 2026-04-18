const variantStyles = {
  default: 'bg-gray-100 text-gray-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  platinum: 'bg-gray-200 text-gray-900 font-semibold',
  gold: 'bg-yellow-100 text-yellow-900 font-semibold',
  silver: 'bg-gray-100 text-gray-800 font-semibold',
  bronze: 'bg-orange-100 text-orange-900 font-semibold',
  brand: 'bg-brand-cream text-brand-primary font-semibold',
};

const sizeStyles = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon: Icon,
  className = '',
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </span>
  );
}
