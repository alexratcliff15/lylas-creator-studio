export function Avatar({
  src,
  initials,
  name,
  size = 'md',
  className = '',
  online = false,
}) {
  const sizeStyles = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  const statusDotSize = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className={`${sizeStyles[size]} rounded-full object-cover border-2 border-white`}
        />
      ) : (
        <div
          className={`${sizeStyles[size]} rounded-full bg-gradient-to-br from-brand-primary to-brand-accent text-white font-bold flex items-center justify-center border-2 border-white`}
        >
          {initials || '?'}
        </div>
      )}

      {online && (
        <span
          className={`absolute bottom-0 right-0 ${statusDotSize[size]} rounded-full bg-green-400 border-2 border-white`}
        />
      )}
    </div>
  );
}
