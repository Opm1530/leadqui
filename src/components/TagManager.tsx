import { useState, useEffect } from "react";
import { auth, db } from "@/integrations/firebase/client";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { firestoreService } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Tag {
  id: string;
  nome: string;
  cor: string;
}

interface TagManagerProps {
  leadId: string;
  assignedTagIds: string[];
  onTagsChanged: () => void;
}

const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const TagManager = ({ leadId, assignedTagIds, onTagsChanged }: TagManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);

  useEffect(() => {
    if (!user) return;
    firestoreService.list("tags", user.uid).then((data: any) => setTags(data || []));
  }, [user]);

  const createTag = async () => {
    if (!user || !newTagName.trim()) return;
    try {
      const docRef = await firestoreService.add("tags", user.uid, {
        nome: newTagName.trim(),
        cor: selectedColor
      });
      const newTag = { id: docRef.id, nome: newTagName.trim(), cor: selectedColor };
      setTags((prev) => [...prev, newTag]);
      setNewTagName("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const toggleTag = async (tagId: string) => {
    try {
      if (assignedTagIds.includes(tagId)) {
        const q = query(collection(db, "lead_tags"), where("lead_id", "==", leadId), where("tag_id", "==", tagId));
        const snap = await getDocs(q);
        for (const d of snap.docs) {
          await deleteDoc(d.ref);
        }
      } else {
        await addDoc(collection(db, "lead_tags"), { lead_id: leadId, tag_id: tagId });
      }
      onTagsChanged();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const deleteTag = async (tagId: string) => {
    try {
      await firestoreService.delete("tags", tagId);
      setTags((prev) => prev.filter((t) => t.id !== tagId));
      onTagsChanged();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag.id}
            onClick={() => toggleTag(tag.id)}
            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${assignedTagIds.includes(tag.id) ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"
              }`}
            style={{
              backgroundColor: `${tag.cor}20`,
              color: tag.cor,
              borderColor: tag.cor,
              ...(assignedTagIds.includes(tag.id) ? { ringColor: tag.cor } : {}),
            }}
          >
            {tag.nome}
            <X
              className="w-3 h-3 hover:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                deleteTag(tag.id);
              }}
            />
          </button>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="Nova tag..."
          className="bg-secondary border-border h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createTag())}
        />
        <div className="flex gap-1">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-all ${selectedColor === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button onClick={createTag} className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default TagManager;
