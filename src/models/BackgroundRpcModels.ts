/** A browser tab group as returned by BackgroundTabService.getGroups() (plugin or user group). */
export type TabGroupInfo = {
  id: number;
  title: string;
  index?: number;
  color?: string;
  collapsed?: boolean;
}

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

/** 🧪 Debug-only snapshot returned by BackgroundTabService.getDiagnostics(). */
export type Diagnostics = {
  allTabs: Array<{ id?: number; title?: string; groupId?: number; lastAccessed?: number }>;
  allGroups: Array<Pick<TabGroupInfo, 'id' | 'title' | 'index'>>;
  tabsInOldestGroup: Array<{ id?: number; title?: string; age?: number }>;
  oldestGroupInfo?: Pick<TabGroupInfo, 'id' | 'title'>;
}
