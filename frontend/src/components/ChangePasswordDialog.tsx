import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { authApi } from '@/services/api';
import { useAuthStore } from '@/store/auth.store';

/** Changement de son propre mot de passe (les autres sessions sont déconnectées). */
export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(currentPassword, newPassword),
    onSuccess: (token) => {
      // Le serveur renvoie un nouveau jeton : cette session reste ouverte
      const { user, login } = useAuthStore.getState();
      if (token && user) login(token, user);
      toast.success('Mot de passe modifié');
      reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors du changement de mot de passe');
    },
  });

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Changer mon mot de passe</DialogTitle>
          <DialogDescription>Vos autres sessions ouvertes seront déconnectées.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!mismatch) mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input id="currentPassword" type="password" autoComplete="current-password" required
              value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword">Nouveau mot de passe</Label>
            <Input id="newPassword" type="password" autoComplete="new-password" required minLength={6}
              value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">6 caractères minimum</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" required
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {mismatch && <p className="text-xs text-red-600">Les mots de passe ne correspondent pas</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending || mismatch}>
              {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
