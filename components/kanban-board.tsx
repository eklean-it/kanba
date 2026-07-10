'use client';

import React, { useMemo, useState } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableProvided,
  DroppableStateSnapshot,
} from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
  Flag,
  Calendar,
  User,
  MessageSquare,
  Check,
  Search,
  X,
  Filter,
  ListChecks,
  Ban,
} from 'lucide-react';

import type { Task, Column, ProjectMember } from '@/lib/types';
import { labelClass } from '@/lib/label-colors';

interface SortableTaskProps {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onViewComments: (task: Task) => void;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  projectMembers: ProjectMember[];
}

function TaskCard({ task, index, onEdit, onDelete, onViewComments, onToggleDone, projectMembers, readOnly, isDragDisabled }: SortableTaskProps & { readOnly?: boolean; isDragDisabled?: boolean }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();
  const assignedUser = projectMembers.find(member => member.user_id === task.assigned_to);
  const due = task.due_date ? new Date(task.due_date) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = !!due && !task.is_done && due < today;
  const isDueSoon = !!due && !task.is_done && !isOverdue && (due.getTime() - today.getTime()) / 86400000 <= 2;

  const handleToggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleDone(task.id, !task.is_done);
  };

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-muted/60 cursor-grab hover:shadow-md transition-shadow ${snapshot.isDragging ? 'ring-2 ring-primary' : ''} ${task.is_done ? 'opacity-75' : ''}`}
        >
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-2 flex-1">
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 mt-0.5 flex-shrink-0"
                      onClick={handleToggleDone}
                    >
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center transition-colors ${
                        task.is_done 
                          ? 'bg-primary border-primary text-primary-foreground' 
                          : 'border-muted-foreground/30 hover:border-primary'
                      }`}>
                        {task.is_done && <Check className="h-3 w-3" />}
                      </div>
                    </Button>
                  )}
                  <h4 className={`font-medium text-sm leading-tight flex-1 line-clamp-2 ${task.is_done ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </h4>
                </div>
                {!readOnly && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onViewComments(task)}><MessageSquare className="h-4 w-4 mr-2" />Comments</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {readOnly && (
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onViewComments(task)}>
                    <MessageSquare className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {task.description && (
                <p className={`text-xs text-muted-foreground line-clamp-2 ${task.is_done ? 'line-through' : ''}`}>
                  {task.description}
                </p>
              )}
              {Array.isArray((task as any).labels) && (task as any).labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(task as any).labels.map((l: any) => (
                    <span key={l.id} className={`rounded-full px-2 py-0.5 text-[10px] ${labelClass(l.color)}`}>{l.name}</span>
                  ))}
                </div>
              )}
              {(task as any).checklist?.total > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ListChecks className="h-3 w-3" />
                  {(task as any).checklist.done}/{(task as any).checklist.total}
                </div>
              )}
              {(task as any).blockedBy > 0 && (
                <div className="inline-flex w-fit items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">
                  <Ban className="h-3 w-3" />Blocked
                </div>
              )}
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <div className="flex items-center space-x-4">
                    <Badge variant="secondary" className={`text-xs ${getPriorityColor(task.priority)}`}><Flag className="h-3 w-3 mr-1" />{task.priority}</Badge>
                </div>
                <div className="flex items-center"><User className="h-3 w-3 mr-1" />{assignedUser ? (assignedUser.profiles.full_name || assignedUser.profiles.email) : 'Unassigned'}</div>
              </div>
              {due && (
                <div className="flex justify-end">
                  <div className={`flex items-center rounded px-1.5 py-0.5 text-xs ${
                    isOverdue
                      ? 'bg-destructive/10 text-destructive'
                      : isDueSoon
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                        : 'text-muted-foreground'
                  }`}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {isOverdue ? 'Overdue · ' : ''}{formatDate(task.due_date!)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  );
}

interface KanbanBoardProps {
  columns: Column[];
  projectMembers: ProjectMember[];
  handleDragEnd: (result: DropResult) => void;
  onEditColumn: (column: Column) => void;
  onDeleteColumn: (columnId: string) => void;
  onAddTask: (columnId: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onViewComments: (task: Task) => void;
  onToggleDone: (taskId: string, isDone: boolean) => void;
  readOnly?: boolean;
}

export function KanbanBoard({
  columns,
  projectMembers,
  handleDragEnd,
  onEditColumn,
  onDeleteColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onViewComments,
  onToggleDone,
  readOnly = false,
}: KanbanBoardProps) {
  const [q, setQ] = useState('');
  const [priority, setPriority] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [dueFilter, setDueFilter] = useState('all');
  const [label, setLabel] = useState('all');
  const allLabels = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    columns.forEach((c) => c.tasks.forEach((t: any) => (t.labels || []).forEach((l: any) => map.set(l.id, { id: l.id, name: l.name }))));
    return Array.from(map.values());
  }, [columns]);
  const filterActive = q !== '' || priority !== 'all' || assignee !== 'all' || dueFilter !== 'all' || label !== 'all';
  const matches = (task: Task) => {
    if (q) {
      const s = q.toLowerCase();
      if (!((task.title || '').toLowerCase().includes(s) || (task.description || '').toLowerCase().includes(s))) return false;
    }
    if (priority !== 'all' && task.priority !== priority) return false;
    if (assignee !== 'all') {
      if (assignee === 'unassigned') { if (task.assigned_to) return false; }
      else if (task.assigned_to !== assignee) return false;
    }
    if (dueFilter !== 'all') {
      const d = task.due_date ? new Date(task.due_date) : null;
      const t0 = new Date(); t0.setHours(0, 0, 0, 0);
      if (dueFilter === 'overdue' && !(d && !task.is_done && d < t0)) return false;
      if (dueFilter === 'none' && d) return false;
    }
    if (label !== 'all' && !(((task as any).labels || []).some((l: any) => l.id === label))) return false;
    return true;
  };
  const clearFilters = () => { setQ(''); setPriority('all'); setAssignee('all'); setDueFilter('all'); setLabel('all'); };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] max-w-xs flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tasks…" className="h-9 pl-8" />
          </div>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {projectMembers.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.profiles?.email || 'Member'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dueFilter} onValueChange={setDueFilter}>
            <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Due" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any due date</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="none">No due date</SelectItem>
            </SelectContent>
          </Select>
          {allLabels.length > 0 && (
            <Select value={label} onValueChange={setLabel}>
              <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Label" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All labels</SelectItem>
                {allLabels.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filterActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9"><X className="mr-1 h-4 w-4" />Clear</Button>
          )}
        </div>
      )}
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {columns.map((column) => {
          const visibleTasks = filterActive ? column.tasks.filter(matches) : column.tasks;
          return (
          <Droppable key={column.id} droppableId={column.id}>
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-shrink-0 w-80"
              >
                <Card className="bg-muted/20 {`transition-colors ${snapshot.isDraggingOver ? 'bg-muted/50' : ''}`}">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm font-medium">{column.name}</CardTitle>
                      {!readOnly && (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{filterActive ? `${visibleTasks.length}/${column.tasks.length}` : column.tasks.length}</Badge>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-3 w-3" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditColumn(column)}><Edit className="h-4 w-4 mr-2" />Rename</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDeleteColumn(column.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {readOnly && (
                        <Badge variant="secondary" className="text-xs">{filterActive ? `${visibleTasks.length}/${column.tasks.length}` : column.tasks.length}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {visibleTasks.map((task, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        onEdit={onEditTask}
                        onDelete={onDeleteTask}
                        onViewComments={onViewComments}
                        onToggleDone={onToggleDone}
                        projectMembers={projectMembers}
                        readOnly={readOnly}
                        isDragDisabled={filterActive}
                      />
                    ))}
                    {provided.placeholder}
                    {!readOnly && (
                      <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" size="sm" onClick={() => onAddTask(column.id)}>
                        <Plus className="h-4 w-4 mr-2" />Add a task
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </Droppable>
          );
        })}
      </div>
    </DragDropContext>
    </div>
  );
}