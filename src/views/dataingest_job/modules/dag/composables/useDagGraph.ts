import { type Ref, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { Graph, type Node } from '@antv/x6';
import { register } from '@antv/x6-vue-shape';
import { Selection } from '@antv/x6-plugin-selection';
import { Snapline } from '@antv/x6-plugin-snapline';
import { MiniMap } from '@antv/x6-plugin-minimap';
import { Scroller } from '@antv/x6-plugin-scroller';
import DagNode from '../nodes/DagNode.vue';

// Types
export type NodeType = 'SOURCE' | 'SINK' | 'TRANSFORM';
export type PluginType = 'JDBC' | 'KAFKA' | 'FAKE' | 'CONSOLE' | 'FIELD_MAPPER' | 'FILTER' | 'REPLACE' | 'SQL';

export interface DagNodeData {
  nodeCode: string;
  taskType: NodeType;
  pluginType: PluginType;
  label: string;
  configured: boolean;
  config: Record<string, any>;
}

export interface DagEdgeData {
  sourceNodeCode: string;
  targetNodeCode: string;
}

const DAG_NODE = 'dag-node';
const DEFAULT_EDGE_ATTRS = {
  line: { stroke: '#A2B1C3', strokeWidth: 2, targetMarker: { name: 'block', width: 12, height: 8 } }
};
let registered = false;

export function useDagGraph(containerRef: Ref<HTMLElement | null>, minimapRef: Ref<HTMLElement | null>) {
  const graph = shallowRef<Graph | null>(null);

  // HTML5 Native Drag State
  const draggedType = shallowRef<{
    taskType: NodeType;
    pluginType: PluginType;
    label: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  let nodeCounter = 0;
  let initRetries = 0;

  // Register custom Vue node shape
  if (!registered) {
    register({
      shape: DAG_NODE,
      width: 220,
      height: 52,
      component: DagNode,
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 5,
                magnet: true,
                stroke: '#C2C8D5',
                strokeWidth: 1,
                fill: '#fff'
              }
            }
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 5,
                magnet: true,
                stroke: '#C2C8D5',
                strokeWidth: 1,
                fill: '#fff'
              }
            }
          }
        }
      }
    });
    registered = true;
  }

  function getPortsByType(taskType: NodeType) {
    const ports: any[] = [];
    if (taskType !== 'SOURCE') {
      ports.push({ id: 'in-port', group: 'in' });
    }
    if (taskType !== 'SINK') {
      ports.push({ id: 'out-port', group: 'out' });
    }
    return ports;
  }

  function initGraph() {
    if (!containerRef.value) return;

    // Ensure container has non-zero dimensions before X6 init
    const rect = containerRef.value.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Container not ready yet (e.g. drawer still animating), retry
      if (initRetries < 10) {
        initRetries += 1;
        requestAnimationFrame(() => initGraph());
      }
      return;
    }
    initRetries = 0;

    const g: Graph = new Graph({
      container: containerRef.value,
      autoResize: true,
      background: { color: '#ffffff' },
      grid: {
        size: 10,
        visible: true
      },
      connecting: {
        router: 'manhattan',
        connector: { name: 'rounded', args: { radius: 8 } },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        allowLoop: false,
        allowMulti: false,
        snap: { radius: 20 },
        createEdge() {
          return g.createEdge({
            attrs: DEFAULT_EDGE_ATTRS
          });
        },
        validateConnection({ sourceCell, targetCell }) {
          if (!sourceCell || !targetCell) return false;
          const sourceData = sourceCell.getData() as DagNodeData;
          const targetData = targetCell.getData() as DagNodeData;
          // SOURCE nodes cannot be targets
          if (targetData.taskType === 'SOURCE') return false;
          // SINK nodes cannot be sources
          if (sourceData.taskType === 'SINK') return false;
          // No self-connections
          if (sourceCell.id === targetCell.id) return false;
          return true;
        }
      }
    });

    // Plugins
    g.use(
      new Scroller({
        enabled: true,
        pageVisible: false,
        pageBreak: false,
        pannable: true,
        modifiers: 'shift'
      })
    );
    g.use(new Selection({ enabled: true, rubberband: false, showNodeSelectionBox: true }));
    g.use(new Snapline({ enabled: true }));
    if (minimapRef.value) {
      g.use(new MiniMap({ container: minimapRef.value, width: 200, height: 150 }));
    }

    graph.value = g;
  }

  function getTypePrefix(taskType: NodeType) {
    if (taskType === 'SOURCE') return 'src';
    if (taskType === 'SINK') return 'sink';
    return 'transform';
  }

  function nextNodeMeta(taskType: NodeType, pluginType: PluginType, label: string) {
    nodeCounter += 1;
    const prefix = getTypePrefix(taskType);
    const nodeCode = `${prefix}_${nodeCounter}`;
    const data: DagNodeData = {
      nodeCode,
      taskType,
      pluginType,
      label,
      configured: false,
      config: {}
    };
    return { nodeCode, data };
  }

  function addNode(
    opts: { taskType: NodeType; pluginType: PluginType; label: string },
    overridePos?: { x: number; y: number }
  ) {
    if (!graph.value) return null;
    const { data } = nextNodeMeta(opts.taskType, opts.pluginType, opts.label);

    let pos = overridePos;
    if (!pos) {
      const existingNodes = graph.value.getNodes().length;
      pos = { x: 100 + existingNodes * 40, y: 100 + existingNodes * 40 };
    }

    const node = graph.value.addNode({
      shape: DAG_NODE,
      x: pos.x,
      y: pos.y,
      data,
      ports: { items: getPortsByType(opts.taskType) }
    });
    return node;
  }

  function handleDragStart(e: DragEvent, opts: { taskType: NodeType; pluginType: PluginType; label: string }) {
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
    }
    draggedType.value = {
      taskType: opts.taskType,
      pluginType: opts.pluginType,
      label: opts.label,
      offsetX: e.offsetX,
      offsetY: e.offsetY
    };
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    if (!graph.value || !draggedType.value) return;

    const p = graph.value.clientToLocal(e.clientX, e.clientY);
    addNode(
      {
        taskType: draggedType.value.taskType,
        pluginType: draggedType.value.pluginType,
        label: draggedType.value.label
      },
      {
        x: p.x - draggedType.value.offsetX,
        y: p.y - draggedType.value.offsetY
      }
    );
    draggedType.value = null;
  }

  function removeSelectedCells() {
    if (!graph.value) return;
    const cells = graph.value.getSelectedCells();
    if (cells.length > 0) {
      graph.value.removeCells(cells);
    }
  }

  function serializeGraph(): { tasks: any[]; lines: any[] } {
    if (!graph.value) return { tasks: [], lines: [] };
    const nodes = graph.value.getNodes();
    const edges = graph.value.getEdges();

    const tasks = nodes.map(node => {
      const data = node.getData() as DagNodeData;
      const pos = node.position();
      const config = data.config || {};
      const {
        nodeCode: _nc,
        taskType: _tt,
        pluginType: _pt,
        nodeName: _nn,
        posX: _px,
        posY: _py,
        ...restConfig
      } = config;
      return {
        nodeCode: data.nodeCode,
        taskType: data.taskType,
        pluginType: data.pluginType,
        nodeName: data.label,
        posX: Math.round(pos.x),
        posY: Math.round(pos.y),
        ...restConfig
      };
    });

    const lines = edges.map(edge => {
      const sourceNode = edge.getSourceNode();
      const targetNode = edge.getTargetNode();
      return {
        sourceNodeCode: sourceNode?.getData()?.nodeCode || '',
        targetNodeCode: targetNode?.getData()?.nodeCode || ''
      };
    });

    return { tasks, lines };
  }

  function deserializeGraph(tasks: any[], lines: any[]) {
    if (!graph.value) return;
    graph.value.clearCells();
    nodeCounter = 0;

    // Create nodes
    const nodeMap = new Map<string, Node>();
    for (const task of tasks) {
      const data: DagNodeData = {
        nodeCode: task.nodeCode,
        taskType: task.taskType,
        pluginType: task.pluginType,
        label: task.nodeName || task.nodeCode,
        configured: true,
        config: { ...task }
      };
      const node = graph.value.addNode({
        shape: DAG_NODE,
        x: task.posX || 100,
        y: task.posY || 100,
        data,
        ports: { items: getPortsByType(task.taskType) }
      });
      nodeMap.set(task.nodeCode, node);

      // Track max counter
      const match = task.nodeCode.match(/_(\d+)$/);
      if (match) {
        const num = Number.parseInt(match[1], 10);
        if (num > nodeCounter) nodeCounter = num;
      }
    }

    // Create edges
    for (const line of lines) {
      const sourceNode = nodeMap.get(line.sourceNodeCode);
      const targetNode = nodeMap.get(line.targetNodeCode);
      if (sourceNode && targetNode) {
        graph.value.addEdge({
          source: { cell: sourceNode.id, port: 'out-port' },
          target: { cell: targetNode.id, port: 'in-port' },
          attrs: DEFAULT_EDGE_ATTRS
        });
      }
    }
  }

  function autoLayout() {
    if (!graph.value) return;
    const nodes = graph.value.getNodes();
    // Simple left-to-right layout by taskType
    const sources = nodes.filter(n => n.getData()?.taskType === 'SOURCE');
    const transforms = nodes.filter(n => n.getData()?.taskType === 'TRANSFORM');
    const sinks = nodes.filter(n => n.getData()?.taskType === 'SINK');

    const xGap = 250;
    const yGap = 80;
    let col = 0;

    [sources, transforms, sinks].forEach(group => {
      if (group.length === 0) return;
      group.forEach((node, i) => {
        node.position(100 + col * xGap, 60 + i * yGap);
      });
      col += 1;
    });

    zoomToFit();
  }

  function zoomToFit() {
    graph.value?.zoomToFit({ padding: 40, maxScale: 1 });
  }

  onMounted(() => {
    initGraph();
  });
  onBeforeUnmount(() => {
    graph.value?.dispose();
  });

  return {
    graph,
    addNode,
    handleDragStart,
    handleDrop,
    removeSelectedCells,
    serializeGraph,
    deserializeGraph,
    autoLayout,
    zoomToFit
  };
}
