import type { Graph } from '@antv/x6';
import type { DagNodeData } from './useDagGraph';

export interface ValidationMessage {
  level: 'error' | 'warning';
  message: string;
  nodeCode?: string;
}

export function useDagValidation() {
  function validate(graph: Graph): ValidationMessage[] {
    const messages: ValidationMessage[] = [];
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    if (nodes.length === 0) {
      messages.push({ level: 'error', message: '请至少添加一个节点' });
      return messages;
    }

    const sources = nodes.filter(n => (n.getData() as DagNodeData).taskType === 'SOURCE');
    const sinks = nodes.filter(n => (n.getData() as DagNodeData).taskType === 'SINK');

    if (sources.length === 0) {
      messages.push({ level: 'error', message: '请至少添加一个数据源(Source)节点' });
    }
    if (sinks.length === 0) {
      messages.push({ level: 'error', message: '请至少添加一个目标(Sink)节点' });
    }

    // Check orphan nodes (no connections)
    for (const node of nodes) {
      const data = node.getData() as DagNodeData;
      const inEdges = graph.getIncomingEdges(node) || [];
      const outEdges = graph.getOutgoingEdges(node) || [];

      if (data.taskType === 'SOURCE' && outEdges.length === 0) {
        messages.push({ level: 'error', message: `源节点 "${data.label}" 没有输出连线`, nodeCode: data.nodeCode });
      }
      if (data.taskType === 'SINK' && inEdges.length === 0) {
        messages.push({ level: 'error', message: `目标节点 "${data.label}" 没有输入连线`, nodeCode: data.nodeCode });
      }
      if (data.taskType === 'TRANSFORM' && (inEdges.length === 0 || outEdges.length === 0)) {
        messages.push({
          level: 'error',
          message: `转换节点 "${data.label}" 需要同时有输入和输出连线`,
          nodeCode: data.nodeCode
        });
      }

      // Check configured
      if (!data.configured) {
        messages.push({ level: 'warning', message: `节点 "${data.label}" 尚未配置`, nodeCode: data.nodeCode });
      }
    }

    // Check for cycles using DFS
    if (hasCycle(nodes, edges)) {
      messages.push({ level: 'error', message: 'DAG 中存在循环引用，请检查连线' });
    }

    return messages;
  }

  function hasCycle(nodes: any[], edges: any[]): boolean {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      const sourceId = edge.getSourceNode()?.id;
      const targetId = edge.getTargetNode()?.id;
      if (sourceId && targetId) {
        adjacency.get(sourceId)?.push(targetId);
      }
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();

    function dfs(nodeId: string): boolean {
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (inStack.has(neighbor)) {
          return true;
        }
      }
      inStack.delete(nodeId);
      return false;
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) return true;
      }
    }
    return false;
  }

  return { validate };
}
