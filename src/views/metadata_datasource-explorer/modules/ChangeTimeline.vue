<script setup lang="ts">
import { computed } from 'vue';
import { NEmpty, NIcon, NSpin, NTag } from 'naive-ui';
import dayjs from 'dayjs';

interface Props {
  records: Api.Metadata.SchemaChange[];
  loading?: boolean;
  emptyDescription?: string;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyDescription: '暂无变更记录'
});

type TagType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface ChangeTypeInfo {
  label: string;
  type: TagType;
}

interface TimelineItem extends Api.Metadata.SchemaChange {
  dateLabel: string;
  timeLabel: string;
  summary: string;
  typeInfo: ChangeTypeInfo;
}

interface DiffSegment {
  text: string;
  added?: boolean;
  removed?: boolean;
}

function pushSegment(list: DiffSegment[], text: string, mode?: 'added' | 'removed') {
  if (!text) return;
  list.push({
    text,
    added: mode === 'added' ? true : undefined,
    removed: mode === 'removed' ? true : undefined
  });
}

function sameTextDiff(text: string): { before: DiffSegment[]; after: DiffSegment[] } {
  return {
    before: text ? [{ text }] : [],
    after: text ? [{ text }] : []
  };
}

function normalizeChange(row: Api.Metadata.SchemaChange): { level: string; normalized: string } {
  return {
    normalized: String(row.changeType || '')
      .trim()
      .toUpperCase()
      .replaceAll('-', '_')
      .replaceAll(' ', '_'),
    level: String(row.entityLevel || '')
      .trim()
      .toLowerCase()
  };
}

function matchesAny(normalized: string, keywords: string[]): boolean {
  return keywords.some(keyword => normalized.includes(keyword));
}

function resolveLevelChange(level: string, normalized: string): ChangeTypeInfo | null {
  const levelMap: Record<string, ChangeTypeInfo[]> = {
    column: [
      { label: '字段注释变更', type: 'warning' },
      { label: '字段类型变更', type: 'warning' },
      { label: '字段新增', type: 'success' },
      { label: '字段删除', type: 'error' }
    ],
    table: [
      { label: '表注释变更', type: 'warning' },
      { label: '表属性变更', type: 'info' },
      { label: '表新增', type: 'success' },
      { label: '表删除', type: 'error' }
    ],
    schema: [
      { label: '数据库结构注释变更', type: 'warning' },
      { label: '数据库结构新增', type: 'success' },
      { label: '数据库结构删除', type: 'error' }
    ],
    database: [
      { label: '数据库注释变更', type: 'warning' },
      { label: '数据库新增', type: 'success' },
      { label: '数据库删除', type: 'error' }
    ]
  };
  const keywordMap: Record<string, string[][]> = {
    column: [
      ['COMMENT', 'CHANGE'],
      ['TYPE', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ],
    table: [['COMMENT', 'CHANGE'], ['PROPERTY'], ['ADD', 'CREATE'], ['DROP', 'DELETE', 'REMOVE']],
    schema: [
      ['COMMENT', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ],
    database: [
      ['COMMENT', 'CHANGE'],
      ['ADD', 'CREATE'],
      ['DROP', 'DELETE', 'REMOVE']
    ]
  };
  const infos = levelMap[level];
  const keywords = keywordMap[level];
  if (!infos || !keywords) return null;
  const matchIndex = keywords.findIndex(group => matchesAny(normalized, group));
  return matchIndex >= 0 ? infos[matchIndex] : null;
}

function resolveGenericChange(normalized: string): ChangeTypeInfo {
  const rules: Array<{ keywords: string[]; info: ChangeTypeInfo }> = [
    { keywords: ['COMMENT', 'CHANGE'], info: { label: '注释变更', type: 'warning' } },
    { keywords: ['PROPERTY'], info: { label: '属性变更', type: 'info' } },
    { keywords: ['TYPE', 'CHANGE'], info: { label: '类型变更', type: 'warning' } },
    { keywords: ['ADD', 'CREATE'], info: { label: '新增', type: 'success' } },
    { keywords: ['DROP', 'DELETE', 'REMOVE'], info: { label: '删除', type: 'error' } },
    { keywords: ['MODIFY', 'ALTER', 'CHANGE'], info: { label: '变更', type: 'warning' } }
  ];
  return rules.find(rule => matchesAny(normalized, rule.keywords))?.info ?? { label: normalized, type: 'default' };
}

function getChangeTypeInfo(row: Api.Metadata.SchemaChange): ChangeTypeInfo {
  const change = normalizeChange(row);
  return resolveLevelChange(change.level, change.normalized) ?? resolveGenericChange(change.normalized);
}

function formatDate(value?: string): string {
  if (!value) return '未知日期';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY年MM月DD日') : value;
}

function formatTime(value?: string): string {
  if (!value) return '--:--';
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('HH:mm:ss') : value;
}

function buildSummary(row: Api.Metadata.SchemaChange, typeInfo: ChangeTypeInfo): string {
  const target = row.columnName || row.tableName || row.databaseName || '对象';
  if (row.entityLevel === 'column') {
    return `${target}发生${typeInfo.label}`;
  }
  if (row.entityLevel === 'table') {
    return `表 ${target} 发生${typeInfo.label}`;
  }
  if (row.entityLevel === 'schema') {
    return `数据库结构 ${target} 发生${typeInfo.label}`;
  }
  return `${target}发生${typeInfo.label}`;
}

function diffText(before?: string, after?: string): { before: DiffSegment[]; after: DiffSegment[] } {
  const beforeText = before || '';
  const afterText = after || '';
  if (!beforeText && !afterText) {
    return { before: [], after: [] };
  }
  if (beforeText === afterText) {
    return sameTextDiff(beforeText);
  }
  if (!beforeText) {
    return { before: [], after: [{ text: afterText, added: true }] };
  }
  if (!afterText) {
    return { before: [{ text: beforeText, removed: true }], after: [] };
  }

  let left = 0;
  const beforeLen = beforeText.length;
  const afterLen = afterText.length;
  while (left < beforeLen && left < afterLen && beforeText[left] === afterText[left]) {
    left += 1;
  }

  let right = 0;
  while (
    right < beforeLen - left &&
    right < afterLen - left &&
    beforeText[beforeLen - 1 - right] === afterText[afterLen - 1 - right]
  ) {
    right += 1;
  }

  const beforePrefix = beforeText.slice(0, left);
  const beforeChanged = beforeText.slice(left, beforeLen - right);
  const beforeSuffix = beforeText.slice(beforeLen - right);
  const afterPrefix = afterText.slice(0, left);
  const afterChanged = afterText.slice(left, afterLen - right);
  const afterSuffix = afterText.slice(afterLen - right);

  const beforeSegments: DiffSegment[] = [];
  const afterSegments: DiffSegment[] = [];
  pushSegment(beforeSegments, beforePrefix);
  pushSegment(beforeSegments, beforeChanged, 'removed');
  pushSegment(beforeSegments, beforeSuffix);
  pushSegment(afterSegments, afterPrefix);
  pushSegment(afterSegments, afterChanged, 'added');
  pushSegment(afterSegments, afterSuffix);
  return { before: beforeSegments, after: afterSegments };
}

const timelineGroups = computed(() => {
  const mapped: TimelineItem[] = (props.records ?? []).map(item => {
    const typeInfo = getChangeTypeInfo(item);
    return {
      ...item,
      dateLabel: formatDate(item.createTime),
      timeLabel: formatTime(item.createTime),
      summary: buildSummary(item, typeInfo),
      typeInfo
    };
  });

  const groupMap = new Map<string, TimelineItem[]>();
  mapped.forEach(item => {
    const list = groupMap.get(item.dateLabel) ?? [];
    list.push(item);
    groupMap.set(item.dateLabel, list);
  });
  return Array.from(groupMap.entries()).map(([dateLabel, items]) => ({ dateLabel, items }));
});
</script>

<template>
  <NSpin :show="loading" class="min-h-180px">
    <NEmpty v-if="!loading && !records.length" :description="emptyDescription" class="timeline-empty py-64px">
      <template #icon>
        <NIcon size="44" class="text-stone-300 dark:text-stone-600">
          <div class="i-mdi-history" />
        </NIcon>
      </template>
    </NEmpty>

    <div v-else class="timeline-wrap">
      <div v-for="group in timelineGroups" :key="group.dateLabel" class="timeline-group">
        <div class="timeline-date">{{ group.dateLabel }}</div>
        <div class="timeline-list">
          <div v-for="item in group.items" :key="String(item.changeId)" class="timeline-item">
            <div class="timeline-rail">
              <div class="timeline-dot" />
              <div class="timeline-line" />
            </div>
            <div class="timeline-card">
              <div class="timeline-card-head">
                <div class="timeline-time">{{ item.timeLabel }}</div>
                <NTag size="small" :bordered="false" :type="item.typeInfo.type">{{ item.typeInfo.label }}</NTag>
              </div>
              <div class="timeline-summary">{{ item.summary }}</div>
              <div class="timeline-meta">
                <span v-if="item.databaseName">数据库 {{ item.databaseName }}</span>
                <span v-if="item.tableName">表 {{ item.tableName }}</span>
                <span v-if="item.columnName">字段 {{ item.columnName }}</span>
              </div>
              <div v-if="item.changeBefore || item.changeAfter" class="timeline-diff">
                <div v-if="item.changeBefore" class="timeline-diff-block timeline-diff-block--before">
                  <div class="timeline-diff-label">变更前</div>
                  <div class="timeline-diff-value">
                    <template
                      v-for="(segment, index) in diffText(item.changeBefore, item.changeAfter).before"
                      :key="`before-${item.changeId}-${index}`"
                    >
                      <span :class="{ 'timeline-diff-fragment--removed': segment.removed }">{{ segment.text }}</span>
                    </template>
                  </div>
                </div>
                <div v-if="item.changeAfter" class="timeline-diff-block timeline-diff-block--after">
                  <div class="timeline-diff-label">变更后</div>
                  <div class="timeline-diff-value">
                    <template
                      v-for="(segment, index) in diffText(item.changeBefore, item.changeAfter).after"
                      :key="`after-${item.changeId}-${index}`"
                    >
                      <span :class="{ 'timeline-diff-fragment--added': segment.added }">{{ segment.text }}</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NSpin>
</template>

<style scoped>
.timeline-wrap {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.timeline-group {
  display: grid;
  gap: 12px;
}

.timeline-date {
  position: sticky;
  top: 0;
  z-index: 1;
  width: fit-content;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(231, 229, 228, 0.82);
  color: rgb(68, 64, 60);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 10px;
}

.timeline-rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.timeline-dot {
  position: relative;
  z-index: 1;
  width: 12px;
  height: 12px;
  margin-top: 16px;
  border: 3px solid rgba(251, 191, 36, 0.8);
  border-radius: 999px;
  background: rgb(255, 251, 235);
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.12);
}

.timeline-line {
  position: absolute;
  top: 28px;
  bottom: -16px;
  width: 1px;
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.4), rgba(148, 163, 184, 0.15));
}

.timeline-item:last-child .timeline-line {
  display: none;
}

.timeline-card {
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.92)),
    linear-gradient(135deg, rgba(59, 130, 246, 0.02), transparent 38%);
  box-shadow:
    0 16px 32px rgba(15, 23, 42, 0.04),
    0 1px 0 rgba(255, 255, 255, 0.86) inset;
  padding: 14px 16px;
}

.timeline-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.timeline-time {
  color: rgb(120, 113, 108);
  font-size: 12px;
  font-weight: 600;
}

.timeline-summary {
  margin-top: 10px;
  color: rgb(28, 25, 23);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
}

.timeline-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
  color: rgb(120, 113, 108);
  font-size: 12px;
}

.timeline-diff {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.timeline-diff-block {
  padding: 12px 12px 10px;
  border-radius: 14px;
}

.timeline-diff-block--before {
  background: rgba(254, 242, 242, 0.88);
  border: 1px solid rgba(254, 202, 202, 0.9);
}

.timeline-diff-block--after {
  background: rgba(240, 253, 244, 0.88);
  border: 1px solid rgba(187, 247, 208, 0.92);
}

.timeline-diff-label {
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgb(120, 113, 108);
}

.timeline-diff-value {
  color: rgb(41, 37, 36);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-all;
}

.timeline-diff-fragment--removed {
  padding: 0 2px;
  border-radius: 4px;
  background: rgba(248, 113, 113, 0.18);
  color: rgb(153, 27, 27);
}

.timeline-diff-fragment--added {
  padding: 0 2px;
  border-radius: 4px;
  background: rgba(74, 222, 128, 0.18);
  color: rgb(21, 128, 61);
}

.timeline-empty {
  border: 1px dashed rgba(203, 213, 225, 0.92);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.72);
}

:deep(.dark) .timeline-date {
  background: rgba(68, 64, 60, 0.86);
  color: rgb(245, 245, 244);
}

:deep(.dark) .timeline-dot {
  border-color: rgba(251, 191, 36, 0.75);
  background: rgb(41, 37, 36);
  box-shadow: 0 0 0 4px rgba(251, 191, 36, 0.12);
}

:deep(.dark) .timeline-line {
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.38), rgba(82, 82, 91, 0.18));
}

:deep(.dark) .timeline-card {
  border-color: rgba(63, 63, 70, 0.9);
  background:
    linear-gradient(180deg, rgba(28, 28, 33, 0.98), rgba(24, 24, 27, 0.92)),
    linear-gradient(135deg, rgba(96, 165, 250, 0.04), transparent 42%);
  box-shadow:
    0 18px 34px rgba(0, 0, 0, 0.22),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
}

:deep(.dark) .timeline-summary {
  color: rgb(245, 245, 244);
}

:deep(.dark) .timeline-time,
:deep(.dark) .timeline-meta,
:deep(.dark) .timeline-diff-label {
  color: rgb(168, 162, 158);
}

:deep(.dark) .timeline-diff-value {
  color: rgb(231, 229, 228);
}

:deep(.dark) .timeline-diff-fragment--removed {
  background: rgba(248, 113, 113, 0.2);
  color: rgb(254, 202, 202);
}

:deep(.dark) .timeline-diff-fragment--added {
  background: rgba(74, 222, 128, 0.18);
  color: rgb(187, 247, 208);
}

:deep(.dark) .timeline-diff-block--before {
  background: rgba(69, 10, 10, 0.28);
  border-color: rgba(127, 29, 29, 0.62);
}

:deep(.dark) .timeline-diff-block--after {
  background: rgba(20, 83, 45, 0.28);
  border-color: rgba(22, 101, 52, 0.6);
}

:deep(.dark) .timeline-empty {
  border-color: rgba(82, 82, 91, 0.85);
  background: rgba(24, 24, 27, 0.76);
}
</style>
