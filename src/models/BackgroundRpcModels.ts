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

export type ActivityLogStatus = 'started' | 'completed' | 'failed' | 'skipped' | 'info'

export type ActivityLogDetails = {
  source: string;
  status: ActivityLogStatus;
  data: Record<string, unknown>;
}

export type ActivityLogEntry = {
  id: string;
  timestamp: number;
  event:
    | 'alarm.triggered'
    | 'alarm.completed'
    | 'alarm.failed'
    | 'alarm.auto_close_skipped'
    | 'tabs.regrouped'
    | 'tabs.ungrouped'
    | 'tab.activated_moved'
    | 'tabs.auto_closed';
  details: ActivityLogDetails;
}
