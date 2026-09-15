import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { emailApi } from '@/services/api';
import { toast } from 'sonner';
import { Mail, Loader2, Paperclip } from 'lucide-react';

type SendFn = (payload: { to: string; toNom?: string; cc?: string; subject: string; body: string }) => Promise<any>;

interface Props {
  open: boolean;
  onClose: () => void;
  // Valeurs pré-remplies
  defaultTo?: string;
  defaultToNom?: string;
  defaultSubject?: string;
  defaultBody?: string;
  // Libellé de la pièce jointe (PDF généré côté serveur)
  attachmentLabel?: string;
  // Fonction d'envoi à appeler
  sendFn: SendFn;
  title?: string;
}

export default function SendEmailModal({
  open, onClose,
  defaultTo = '', defaultToNom = '',
  defaultSubject = '', defaultBody = '',
  attachmentLabel,
  sendFn,
  title = 'Envoyer par email',
}: Props) {
  const [to, setTo] = useState(defaultTo);
  const [toNom, setToNom] = useState(defaultToNom);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);

  // Reset quand on rouvre
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setTo(defaultTo);
      setToNom(defaultToNom);
      setSubject(defaultSubject);
      setBody(defaultBody);
      setCc('');
      setShowCc(false);
    } else {
      onClose();
    }
  };

  const handleSend = async () => {
    if (!to.trim()) { toast.error("L'adresse email du destinataire est requise"); return; }
    if (!subject.trim()) { toast.error("L'objet est requis"); return; }
    setSending(true);
    try {
      await sendFn({ to: to.trim(), toNom: toNom.trim() || undefined, cc: cc.trim() || undefined, subject: subject.trim(), body });
      toast.success('Email envoyé');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Destinataire */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email-to">Destinataire *</Label>
              <Input
                id="email-to"
                type="email"
                placeholder="client@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-toNom">Nom (optionnel)</Label>
              <Input
                id="email-toNom"
                placeholder="Nom du destinataire"
                value={toNom}
                onChange={(e) => setToNom(e.target.value)}
              />
            </div>
          </div>

          {/* CC */}
          {showCc ? (
            <div className="space-y-1.5">
              <Label htmlFor="email-cc">Copie (CC)</Label>
              <Input
                id="email-cc"
                type="email"
                placeholder="cc@example.com"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-xs text-blue-600 hover:underline"
            >
              + Ajouter une copie (CC)
            </button>
          )}

          {/* Objet */}
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Objet *</Label>
            <Input
              id="email-subject"
              placeholder="Objet de l'email"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Corps */}
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              rows={7}
              placeholder="Contenu de votre email..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {/* Pièce jointe */}
          {attachmentLabel && (
            <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <Paperclip className="h-4 w-4 shrink-0" />
              <span>{attachmentLabel} — joint automatiquement</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button onClick={handleSend} disabled={sending || !to.trim() || !subject.trim()}>
            {sending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Envoi...</>
            ) : (
              <><Mail className="h-4 w-4 mr-2" />Envoyer</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
