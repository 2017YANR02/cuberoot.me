/** @module Shared workspace checklist and schedule contracts and calendar arithmetic. */
export type ChecklistItem = { id: string; text: string; done: boolean };
export type WorkspaceBoard = {
  id: string; projectId: string | null; name: string; version: number;
  active: boolean; projectName: string | null; projectActive: boolean | null;
  canEdit: boolean;
};
export type Checklist = WorkspaceBoard & { category: string; items: ChecklistItem[] };

/** Stable partition: restoring an item returns it to its original position. */
export function orderChecklistItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items.filter(item => !item.done), ...items.filter(item => item.done)];
}
