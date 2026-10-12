import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, FileSearch, Info, Loader2, Plus } from 'lucide-react';
import {
  COMPOUND_CATALOG,
  CATALOG_BY_COLUMN,
  purchaseId as purchaseIdSchema,
  type CompoundColumn,
  type ExtractedField,
  type ExtractionResult,
} from '@cr/contracts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ConfidenceChip } from '@/components/common/confidence-chip';
import { DocumentPreview } from './document-preview';
import { ReviewFieldRow } from './review-field-row';
import {
  initialReviewState,
  needsAttention,
  reviewGate,
  toConfirmValues,
  type ReviewState,
} from './review-state';

const METHOD_LABEL = { 'text-layer': 'Text layer', ocr: 'Text recognition', hybrid: 'Mixed' } as const;

type Props = {
  file: File;
  result: ExtractionResult;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (body: {
    extractionId: string;
    purchaseId: string;
    values: Record<CompoundColumn, string | null>;
  }) => void;
};

export function ReviewPanel({ file, result, saving, onCancel, onConfirm }: Props) {
  const [state, setState] = useState<ReviewState>(() => initialReviewState(result));
  const [added, setAdded] = useState<ExtractedField[]>([]);
  const [showRaw, setShowRaw] = useState(false);
  const fields = useMemo(() => [...result.fields, ...added], [result.fields, added]);
  const gate = reviewGate(fields, state);
  const purchaseError = purchaseIdSchema.safeParse(state.purchaseId).error?.issues[0]?.message;
  const flagged = fields.filter(needsAttention);
  const clean = fields.filter((f) => !needsAttention(f));
  const available = COMPOUND_CATALOG.filter((d) => !(d.column in state.values));
  const filledCount = Object.values(state.values).filter((v) => v?.trim()).length;

  const update = (fn: (s: ReviewState) => void) =>
    setState((s) => {
      const next = {
        ...s,
        values: { ...s.values },
        accepted: new Set(s.accepted),
        edited: new Set(s.edited),
      };
      fn(next);
      return next;
    });
  const addColumn = (column: CompoundColumn, value = '') => {
    const def = CATALOG_BY_COLUMN.get(column)!;
    setAdded((a) => [
      ...a,
      { column, label: def.label, value: null, rawText: '', confidence: 1, uncertainty: null, flags: [] },
    ]);
    update((s) => {
      s.values[column] = value;
      s.edited.add(column);
    });
  };
  const row = (f: ExtractedField) => (
    <ReviewFieldRow
      key={f.column}
      field={f}
      value={state.values[f.column] ?? ''}
      accepted={state.accepted.has(f.column)}
      onChange={(v) =>
        update((s) => {
          s.values[f.column] = v;
          s.edited.add(f.column);
        })
      }
      onAccept={(a) => update((s) => (a ? s.accepted.add(f.column) : s.accepted.delete(f.column)))}
    />
  );

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden lg:block">
        <div className="sticky top-20">
          <DocumentPreview file={file} />
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{METHOD_LABEL[result.method]}</Badge>
              <Badge variant="outline" className="num">
                {result.pages} page{result.pages > 1 ? 's' : ''}
              </Badge>
              <ConfidenceChip value={result.overallConfidence} />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="ml-auto lg:hidden">
                    <FileSearch /> View document
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[90dvh]">
                  <SheetHeader>
                    <SheetTitle>{file.name}</SheetTitle>
                  </SheetHeader>
                  <div className="px-4">
                    <DocumentPreview file={file} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-purchase">Purchase ID</Label>
              <Input
                id="review-purchase"
                value={state.purchaseId}
                onChange={(e) =>
                  update((s) => {
                    s.purchaseId = e.target.value;
                  })
                }
                aria-invalid={!!purchaseError}
                className="num max-w-xs"
              />
              {purchaseError && <p className="text-sm text-destructive">{purchaseError}</p>}
            </div>
          </CardHeader>
        </Card>

        {result.warnings.map((w) => (
          <Alert key={w.code} className="border-warning-border bg-warning-surface text-warning">
            <AlertTriangle />
            <AlertTitle>{w.code === 'DUPLICATE_FILE' ? 'Already uploaded' : 'Check the values'}</AlertTitle>
            <AlertDescription className="text-foreground/80">{w.message}</AlertDescription>
          </Alert>
        ))}

        {flagged.length > 0 && (
          <Card className="border-warning-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-warning" /> Needs review{' '}
                <Badge variant="secondary" className="num">
                  {flagged.length}
                </Badge>
              </CardTitle>
              <CardDescription>
                Correct each value or tick “Looks correct” after checking it against the document.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">{flagged.map(row)}</CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Extracted values{' '}
              <Badge variant="secondary" className="num ml-1">
                {clean.length}
              </Badge>
            </CardTitle>
            <CardDescription>Columns not listed are saved as empty, never as zero.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {clean.length ? (
              clean.map(row)
            ) : (
              <p className="text-sm text-muted-foreground">No other values were recognised.</p>
            )}
            <div className="flex items-center gap-2 pt-2">
              <Select value="" onValueChange={(c) => addColumn(c as CompoundColumn)}>
                <SelectTrigger className="w-full sm:w-72" aria-label="Add a value the scan missed">
                  <Plus className="size-4" />
                  <SelectValue placeholder="Add a value the scan missed" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {available.map((d) => (
                    <SelectItem key={d.column} value={d.column}>
                      <span className="num">{d.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {result.unmapped.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="size-4 text-muted-foreground" /> Found but not saved
              </CardTitle>
              <CardDescription>
                These values appear on the report but have no automatic column in the Compound table.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {result.unmapped.map((u, i) => {
                  const manual = COMPOUND_CATALOG.find((d) => d.label === u.label && !d.autoFill);
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                      <span className="num w-20 font-medium">{u.label}</span>
                      <span className="num">{u.value ?? '—'} %</span>
                      <span className="text-muted-foreground">
                        {u.reason === 'no_column' ? 'No matching column' : 'Needs manual confirmation'}
                      </span>
                      {manual && !(manual.column in state.values) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="ml-auto h-7"
                          onClick={() => addColumn(manual.column, u.value ?? '')}
                        >
                          Use value
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((s) => !s)} aria-expanded={showRaw}>
            <ChevronDown className={showRaw ? 'rotate-180' : ''} /> {showRaw ? 'Hide' : 'Show'} recognised
            text
          </Button>
          {showRaw && (
            <pre className="num mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted p-4 text-xs">
              {result.rawText}
            </pre>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur lg:left-[var(--sidebar-width,16rem)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p className="text-sm" aria-live="polite">
            {gate.pending.length > 0 ? (
              <span className="text-warning">
                {gate.pending.length === 1
                  ? '1 value still needs review'
                  : `${gate.pending.length} values still need review`}
              </span>
            ) : gate.invalid.length > 0 ? (
              <span className="text-destructive">
                Fix {gate.invalid.length} invalid value{gate.invalid.length > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-muted-foreground">
                Ready to save <span className="num">{filledCount}</span> values
              </span>
            )}
          </p>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Start over
            </Button>
            <Button
              disabled={!gate.canConfirm || !!purchaseError || saving}
              onClick={() =>
                onConfirm({
                  extractionId: result.extractionId,
                  purchaseId: state.purchaseId.trim(),
                  values: toConfirmValues(state),
                })
              }
            >
              {saving && <Loader2 className="animate-spin" />} Confirm and save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
