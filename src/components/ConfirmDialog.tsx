import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

type ConfirmOpts = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  alertOnly?: boolean; // sem botão cancelar (equivale a um alert)
};

let openExternal: ((opts: ConfirmOpts) => void) | null = null;
let resolver: ((v: boolean) => void) | null = null;

// Confirmação própria (substitui window.confirm). Retorna Promise<boolean>.
export function confirm(opts: ConfirmOpts | string): Promise<boolean> {
  const o: ConfirmOpts = typeof opts === "string" ? { description: opts } : opts;
  if (!openExternal) return Promise.resolve(window.confirm(o.description || o.title || "Confirmar?"));
  return new Promise<boolean>((resolve) => { resolver = resolve; openExternal!(o); });
}

// Aviso próprio (substitui window.alert).
export function alertDialog(message: string, title?: string): Promise<boolean> {
  return confirm({ title: title || "Aviso", description: message, alertOnly: true, confirmText: "Ok" });
}

export function ConfirmProvider() {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  useEffect(() => { openExternal = setOpts; return () => { openExternal = null; }; }, []);

  const close = (v: boolean) => { setOpts(null); const r = resolver; resolver = null; r?.(v); };

  return (
    <Dialog open={!!opts} onOpenChange={(o) => { if (!o) close(false); }}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {opts?.danger && <AlertTriangle className="w-5 h-5 text-red-400" />}
            {opts?.title || "Confirmar"}
          </DialogTitle>
        </DialogHeader>
        {opts?.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{opts.description}</p>}
        <DialogFooter className="mt-2">
          {!opts?.alertOnly && (
            <Button variant="outline" onClick={() => close(false)} className="border-border">
              {opts?.cancelText || "Cancelar"}
            </Button>
          )}
          <Button onClick={() => close(true)} className={opts?.danger ? "bg-red-600 hover:bg-red-700 text-white" : "gradient-button"}>
            {opts?.confirmText || "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
