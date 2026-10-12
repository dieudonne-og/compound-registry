import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { useT } from '@/i18n/i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Shows a temporary password once; it is not stored anywhere the administrator could see it again. */
export function TemporaryPasswordDialog({
  value,
  userName,
  onClose,
}: {
  value: string | null;
  userName: string;
  onClose: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value ?? '');
      setCopied(true);
    } catch {
      /* clipboard blocked: the field is selectable */
    }
  };
  return (
    <Dialog
      open={value !== null}
      onOpenChange={(open) => {
        if (!open) {
          setCopied(false);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" /> {t('admin.users.temporary.title')}
          </DialogTitle>
          <DialogDescription>{userName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="temporary-password">{t('admin.users.temporary.label')}</Label>
          <div className="flex gap-2">
            <Input
              id="temporary-password"
              readOnly
              value={value ?? ''}
              className="num text-base tracking-wider"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? t('admin.users.temporary.copied') : t('admin.users.temporary.copy')}
            </Button>
          </div>
        </div>
        <Alert className="border-warning-border bg-warning-surface">
          <AlertDescription className="text-foreground/80">
            {t('admin.users.temporary.warning')}
          </AlertDescription>
        </Alert>
        <DialogFooter>
          <Button onClick={onClose}>{t('admin.users.temporary.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
