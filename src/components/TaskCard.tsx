import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Calendar, MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskCardProps {
  task: any;
  onClick: (task: any) => void;
}

const PRIORITY_COLORS: any = {
  BAIXA: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  MEDIA: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  ALTA: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  URGENTE: "bg-red-500/10 text-red-500 border-red-500/20",
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task)}
      className="glass-card p-5 group hover:border-orange-500/30 transition-all cursor-pointer select-none"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
            {task.client?.name || "Sem Cliente"}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-60">
              {task.project?.name || "Sem Projeto"}
            </span>
            {task.project?.type === 'UNICO' && (
              <span className="text-[7px] font-black bg-orange-500 text-white px-1 rounded-sm">JOB ÚNICO</span>
            )}
            {task.project?.type === 'RECORRENTE' && (
              <span className="text-[7px] font-black bg-blue-500/20 text-blue-400 px-1 rounded-sm">RECORRENTE</span>
            )}
          </div>
        </div>
        <Badge variant="outline" className={`text-[9px] font-black px-1.5 py-0.5 border-0 ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.MEDIA}`}>
          {task.priority || "MEDIA"}
        </Badge>
      </div>

      <h4 className="font-bold text-foreground mb-4 line-clamp-2 text-sm leading-tight group-hover:text-white transition-colors">
        {task.title}
      </h4>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-orange-500/20 border-2 border-background flex items-center justify-center text-[10px] font-bold text-orange-500">
            {task.responsible?.name?.charAt(0) || "U"}
          </div>
          {task.responsible?.position && (
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10">
              {task.responsible.position}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {task.due_date ? new Date(task.due_date).toLocaleDateString() : "Sem prazo"}
        </div>
      </div>
    </div>
  );
}
