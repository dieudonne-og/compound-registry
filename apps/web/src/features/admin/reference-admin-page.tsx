import { useState } from 'react';
import { toast } from 'sonner';
import { Archive, ArchiveRestore, Database, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { REFERENCE_KINDS, type ReferenceItem, type ReferenceKind } from '@cr/contracts';
import { useT } from '@/i18n/i18n';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { useAdminReference, useSaveReference } from './api';
import { AdminGuard } from './admin-guard';

type Editing = { mode: 'add' } | { mode: 'rename'; item: ReferenceItem } | null;

function EntryDialog({
  kind,
  editing,
  onClose,
}: {
  kind: ReferenceKind;
  editing: Editing;
  onClose: () => void;
}) {
  const t = useT();
  const save = useSaveReference(kind);
  const item = editing?.mode === 'rename' ? editing.item : null;
  const [name, setName] = useState(item?.name ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const minerals = kind === 'mineral-types';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: item?.id, name: name.trim(), ...(minerals ? { code: code.trim() || undefined } : {}) },
      {
        onSuccess: () => {
          toast.success(t(item ? 'admin.reference.updated' : 'admin.reference.created'));
          onClose();
        },
        onError: (err) => {
          if (err instanceof ApiError && Object.keys(err.fieldErrors).length)
            return setErrors(err.fieldErrors);
          setErrors({ name: err instanceof ApiError ? err.message : 'common.unknownError' });
        },
      },
    );
  };

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t(item ? 'admin.reference.renameTitle' : 'admin.reference.addTitle')}</DialogTitle>
          </DialogHeader>
          <FormField label={t('admin.reference.name')} htmlFor="entry-name" required error={errors.name}>
            <Input
              id="entry-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              aria-describedby="entry-name-error"
            />
          </FormField>
          {minerals && (
            <FormField
              label={t('admin.reference.code')}
              htmlFor="entry-code"
              required
              error={errors.code}
              hint={t('admin.reference.codeHint')}
            >
              <Input
                id="entry-code"
                className="num uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={8}
                aria-describedby="entry-code-error"
              />
            </FormField>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} {t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindPanel({ kind }: { kind: ReferenceKind }) {
  const t = useT();
  const { data, error, isLoading, refetch } = useAdminReference(kind);
  const save = useSaveReference(kind);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [retiring, setRetiring] = useState<ReferenceItem | null>(null);
  const minerals = kind === 'mineral-types';
  const needle = search.trim().toLowerCase();
  const rows = (data ?? []).filter(
    (r) => !needle || `${r.name} ${r.code ?? ''}`.toLowerCase().includes(needle),
  );

  const setActive = (item: ReferenceItem, active: boolean) =>
    save.mutate(
      { id: item.id, active },
      {
        onSuccess: () => toast.success(t(active ? 'admin.reference.reactivated' : 'admin.reference.retired')),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : t('common.unknownError')),
      },
    );

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.reference.search')}
            aria-label={t('admin.reference.search')}
            className="pl-9"
          />
        </div>
        <Button className="sm:ml-auto" onClick={() => setEditing({ mode: 'add' })}>
          <Plus /> {t('admin.reference.add')}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : !rows.length ? (
        <EmptyState
          icon={Database}
          title={needle ? t('admin.reference.noMatch') : t('admin.reference.empty')}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>{t('admin.reference.columns.name')}</TableHead>
                {minerals && <TableHead>{t('admin.reference.columns.code')}</TableHead>}
                <TableHead>{t('admin.reference.columns.status')}</TableHead>
                <TableHead className="text-right">{t('admin.reference.columns.usage')}</TableHead>
                <TableHead className="text-right">{t('admin.reference.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  {minerals && <TableCell className="num">{r.code}</TableCell>}
                  <TableCell>
                    <Badge variant={r.active ? 'secondary' : 'outline'}>
                      {t(r.active ? 'admin.status.active' : 'admin.status.retired')}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-right">{r.usageCount}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing({ mode: 'rename', item: r })}
                      >
                        <Pencil /> {t('admin.reference.rename')}
                      </Button>
                      {r.active ? (
                        <Button variant="ghost" size="sm" onClick={() => setRetiring(r)}>
                          <Archive /> {t('admin.reference.retire')}
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setActive(r, true)}>
                          <ArchiveRestore /> {t('admin.reference.reactivate')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* key: a fresh form for each entry */}
      <EntryDialog
        key={editing?.mode === 'rename' ? editing.item.id : (editing?.mode ?? 'closed')}
        kind={kind}
        editing={editing}
        onClose={() => setEditing(null)}
      />
      <AlertDialog open={retiring !== null} onOpenChange={(open) => !open && setRetiring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('admin.reference.retireTitle', { name: retiring?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('admin.reference.retireBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (retiring) setActive(retiring, false);
                setRetiring(null);
              }}
            >
              {t('admin.reference.retire')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function Component() {
  const t = useT();
  return (
    <AdminGuard>
      <PageHeader title={t('admin.reference.title')} description={t('admin.reference.description')} />
      <Tabs defaultValue="companies">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          {REFERENCE_KINDS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`admin.reference.kinds.${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {REFERENCE_KINDS.map((k) => (
          <TabsContent key={k} value={k}>
            <KindPanel kind={k} />
          </TabsContent>
        ))}
      </Tabs>
    </AdminGuard>
  );
}
