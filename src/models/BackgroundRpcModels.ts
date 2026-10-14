export type GroupByIndex = { id: number; title: string; index: number }

export type GroupTabDataRow = {
  id?: number;
  url?: string;
  title?: string;
  active?: boolean;
  lastAccessed?: number;
  groupId?: number;
  windowIndex?: number;
  positionInGroup?: number | null;
}

export type GroupAndTabData = {
  groupCount: number;
  groupsOrderedByIndex: GroupByIndex[];
  groupedTabCount: number;
  ungroupedTabCount: number;
  tabs: GroupTabDataRow[];
}
