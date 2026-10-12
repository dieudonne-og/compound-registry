import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2, MoreHorizontal, Pencil, Plus, UserCheck, UserX, Users } from 'lucide-react';
import { ROLES, type Role, type UserAdminView } from '@cr/contracts';
import { useFormat, useT } from '@/i18n/i18n';
import { ApiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { useSession } from '@/features/auth/session';
import { useUserMutations, useUsers } from './api';
import { AdminGuard } from './admin-guard';
import { TemporaryPasswordDialog } from './temporary-password-dialog';

type Editing = { mode: 'add' } | { mode: 'edit'; user: UserAdminView } | null;
type Confirm = { kind: 'disable' | 'enable' | 'reset'; user: UserAdminView } | null;

function UserDialog({
  editing,
  isSelf,
  onClose,
  onCreated,
}: {
  editing: Editing;
  isSelf: boolean;
  onClose: () => void;
  onCreated: (name: string, password: string) => void;
}) {
  const t = useT();
  const { create, update } = useUserMutations();
  const user = editing?.mode === 'edit' ? editing.user : null;
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Role>(user?.role ?? 'operator');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const pending = create.isPending || update.isPending;

  const fail = (err: unknown) => {
    if (err instanceof ApiError) {
      const fields = { ...err.fieldErrors };
      if (typeof err.details?.field === 'string') fields[err.details.field] = err.message;
      setErrors(Object.keys(fields).length ? fields : { name: err.message });
    } else setErrors({ name: 'common.unknownError' });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (user) {
      update.mutate(
        { id: user.id, name: name.trim(), ...(isSelf ? {} : { role }) },
        {
          onSuccess: () => {
            toast.success(t('admin.users.updated'));
            onClose();
          },
          onError: fail,
        },
      );
    } else {
      create.mutate(
        { name: name.trim(), email: email.trim(), role },
        {
          onSuccess: (res) => {
            toast.success(t('admin.users.created'));
            onClose();
            onCreated(res.user.name, res.temporaryPassword);
          },
          onError: fail,
        },
      );
    }
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t(user ? 'admin.users.editTitle' : 'admin.users.addTitle')}</DialogTitle>
          </DialogHeader>
          <FormField label={t('admin.users.name')} htmlFor="user-name" required error={errors.name}>
            <Input
              id="user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              aria-describedby="user-name-error"
            />
          </FormField>
          <FormField
            label={t('admin.users.email')}
            htmlFor="user-email"
            required={!user}
            error={errors.email}
          >
            <Input
              id="user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!user}
              autoComplete="off"
              aria-describedby="user-email-error"
            />
          </FormField>
          <FormField
            label={t('admin.users.role')}
            htmlFor="user-role"
            required
            error={errors.role}
            hint={isSelf ? t('admin.users.self') : undefined}
          >
            <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}{' '}
              {t(user ? 'common.save' : 'admin.users.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Component() {
  const t = useT();
  const format = useFormat();
  const { user: me } = useSession();
  const { data, error, isLoading, refetch } = useUsers();
  const { update, resetPassword } = useUserMutations();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [temporary, setTemporary] = useState<{ name: string; password: string } | null>(null);

  const onError = (err: unknown) =>
    toast.error(err instanceof ApiError ? err.message : t('common.unknownError'));
  const runConfirmed = () => {
    if (!confirm) return;
    const { kind, user } = confirm;
    setConfirm(null);
    if (kind === 'reset')
      return resetPassword.mutate(user.id, {
        onSuccess: (res) => {
          toast.success(t('admin.users.reset'));
          setTemporary({ name: res.user.name, password: res.temporaryPassword });
        },
        onError,
      });
    update.mutate(
      { id: user.id, active: kind === 'enable' },
      { onSuccess: () => toast.success(t(`admin.users.${kind}d`)), onError },
    );
  };

  return (
    <AdminGuard>
      <PageHeader
        title={t('admin.users.title')}
        description={t('admin.users.description')}
        actions={
          <Button onClick={() => setEditing({ mode: 'add' })}>
            <Plus /> {t('admin.users.add')}
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data.length ? (
        <EmptyState icon={Users} title={t('admin.users.title')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t('admin.users.columns.name')}</TableHead>
                <TableHead>{t('admin.users.columns.email')}</TableHead>
                <TableHead>{t('admin.users.columns.role')}</TableHead>
                <TableHead>{t('admin.users.columns.status')}</TableHead>
                <TableHead>{t('admin.users.columns.lastSignIn')}</TableHead>
                <TableHead className="text-right">{t('admin.users.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`roles.${u.role}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={u.active ? 'secondary' : 'outline'}>
                          {t(u.active ? 'admin.status.active' : 'admin.status.disabled')}
                        </Badge>
                        {u.mustChangePassword && (
                          <Badge variant="outline">{t('admin.users.mustChange')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {u.lastSignInAt ? format.relative(u.lastSignInAt) : t('admin.users.never')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t('admin.users.menu', { name: u.name })}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          {isSelf && (
                            <>
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                {t('admin.users.self')}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          <DropdownMenuItem onSelect={() => setEditing({ mode: 'edit', user: u })}>
                            <Pencil /> {t('admin.users.edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isSelf}
                            onSelect={() => setConfirm({ kind: u.active ? 'disable' : 'enable', user: u })}
                          >
                            {u.active ? <UserX /> : <UserCheck />}
                            {t(u.active ? 'admin.users.disable' : 'admin.users.enable')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setConfirm({ kind: 'reset', user: u })}>
                            <KeyRound /> {t('admin.users.resetPassword')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* key: a fresh form for each user */}
      <UserDialog
        key={editing?.mode === 'edit' ? editing.user.id : (editing?.mode ?? 'closed')}
        editing={editing}
        isSelf={editing?.mode === 'edit' && editing.user.id === me?.id}
        onClose={() => setEditing(null)}
        onCreated={(name, password) => setTemporary({ name, password })}
      />
      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm && t(`admin.users.${confirm.kind}Title`, { name: confirm.user.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirm && t(`admin.users.${confirm.kind}Body`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirmed}>
              {confirm &&
                t(
                  confirm.kind === 'reset'
                    ? 'admin.users.resetPassword'
                    : confirm.kind === 'disable'
                      ? 'admin.users.disable'
                      : 'admin.users.enable',
                )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TemporaryPasswordDialog
        value={temporary?.password ?? null}
        userName={temporary?.name ?? ''}
        onClose={() => setTemporary(null)}
      />
    </AdminGuard>
  );
}
