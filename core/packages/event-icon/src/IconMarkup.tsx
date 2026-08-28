interface IconMarkupProps {
  ariaLabel: string;
  className?: string;
  icon: string;
  svg?: string;
  title?: string;
}

export function IconMarkup({ ariaLabel, className, icon, svg, title }: IconMarkupProps) {
  const classes = `cubing-icon ${icon}${className ? ` ${className}` : ''}`;
  return (
    <span
      aria-label={ariaLabel}
      className={classes}
      title={title}
      {...(svg ? { dangerouslySetInnerHTML: { __html: svg } } : {})}
    />
  );
}
