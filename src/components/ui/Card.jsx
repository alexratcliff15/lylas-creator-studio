export function Card({
  children,
  padding = 'p-6',
  border = true,
  shadow = true,
  hover = true,
  className = '',
}) {
  return (
    <div
      className={`
        bg-white rounded-xl
        ${padding}
        ${border ? 'border border-gray-200' : ''}
        ${shadow ? 'shadow-sm' : ''}
        ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
