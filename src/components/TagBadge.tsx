interface TagBadgeProps {
  nome: string;
  cor: string;
  onRemove?: () => void;
}

const TagBadge = ({ nome, cor, onRemove }: TagBadgeProps) => (
  <span
    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
    style={{ backgroundColor: `${cor}20`, color: cor }}
  >
    {nome}
    {onRemove && (
      <button onClick={onRemove} className="ml-0.5 hover:opacity-70">×</button>
    )}
  </span>
);

export default TagBadge;
