'use client';

import { useState } from 'react';
import type { Column, Task } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { labelClass } from '@/lib/label-colors';

const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Month calendar of tasks by due date.
export function TaskCalendarView({ columns, onEditTask }: { columns: Column[]; onEditTask: (t: Task) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const byDay: Record<string, any[]> = {};
  columns.flatMap((c) => c.tasks).forEach((t: any) => {
    if (t.due_date) (byDay[localKey(new Date(t.due_date))] ||= []).push(t);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = localKey(new Date());
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shift = (n: number) => {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + n);
    setCursor(d);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              setCursor(d);
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="bg-muted/40 px-2 py-1 text-center font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((d, i) => {
          const key = d ? `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
          const dayTasks = d ? byDay[key] || [] : [];
          return (
            <div key={i} className={`min-h-[86px] bg-background p-1 ${key && key === todayKey ? 'ring-1 ring-inset ring-primary' : ''}`}>
              {d && <div className="mb-1 text-right text-[10px] text-muted-foreground">{d}</div>}
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onEditTask(t)}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${t.is_done ? 'text-muted-foreground line-through' : ''} ${t.labels?.[0] ? labelClass(t.labels[0].color) : 'bg-muted'}`}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTasks.length > 3 && <div className="text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
