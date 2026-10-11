import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Props = {
  id?: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  disableFuture?: boolean;
  invalid?: boolean;
  'aria-describedby'?: string;
};

/** Value is a calendar date string (YYYY-MM-DD); no time zone involved. */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = 'Pick a date',
  disableFuture,
  invalid,
  ...aria
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          aria-describedby={aria['aria-describedby']}
          className={cn('w-full justify-start font-normal', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="size-4" />
          {selected ? format(selected, 'd MMM yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          autoFocus
          captionLayout="dropdown"
          disabled={disableFuture ? { after: new Date() } : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, 'yyyy-MM-dd') : undefined);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
