import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { NETWORK_EDGES, NODE_LABELS, type NodeName } from '@/api/bayesian';

interface NodeState {
  name: NodeName;
  p_pass: number;
}

interface Props {
  nodeStates: NodeState[];
  activeNode: NodeName | null;
  onNodeClick: (node: NodeName) => void;
}

const NODE_POSITIONS: Record<NodeName, { x: number; y: number }> = {
  DOC_VERIFY:        { x: 0.15, y: 0.50 },
  FACE_SCAN:         { x: 0.38, y: 0.25 },
  GSA_RESULT:        { x: 0.38, y: 0.75 },
  PDMA_RESULT:       { x: 0.62, y: 0.75 },
  RISK_RESULT:       { x: 0.62, y: 0.25 },
  IDENTITY_VERIFIED: { x: 0.85, y: 0.50 },
};

function passColor(p: number): string {
  if (p >= 0.75) return '#4ADE80';
  if (p >= 0.50) return '#FCD34D';
  return '#F87171';
}

export function BayesianGraph({ nodeStates, activeNode, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();

    const W = svgRef.current!.clientWidth || 700;
    const H = svgRef.current!.clientHeight || 380;
    const R = 36;

    const defs = svg.append('defs');

    // Glow filter
    const filter = defs.append('filter').attr('id', 'glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#334155');

    const nodeMap = new Map(nodeStates.map(n => [n.name, n]));

    const px = (rx: number) => rx * W;
    const py = (ry: number) => ry * H;

    // Draw edges
    for (const [src, dst] of NETWORK_EDGES) {
      const sp = NODE_POSITIONS[src];
      const dp = NODE_POSITIONS[dst];
      const x1 = px(sp.x), y1 = py(sp.y);
      const x2 = px(dp.x), y2 = py(dp.y);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / len, ny = dy / len;

      svg.append('line')
        .attr('x1', x1 + nx * R)
        .attr('y1', y1 + ny * R)
        .attr('x2', x2 - nx * (R + 2))
        .attr('y2', y2 - ny * (R + 2))
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrow)');
    }

    // Draw nodes
    for (const ns of nodeStates) {
      const pos = NODE_POSITIONS[ns.name];
      const cx = px(pos.x), cy = py(pos.y);
      const color = passColor(ns.p_pass);
      const isActive = ns.name === activeNode;

      const g = svg.append('g')
        .style('cursor', 'pointer')
        .on('click', () => onNodeClick(ns.name));

      // Glow ring for active
      if (isActive) {
        g.append('circle')
          .attr('cx', cx).attr('cy', cy)
          .attr('r', R + 8)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('opacity', 0.4)
          .attr('filter', 'url(#glow)');
      }

      // Background circle
      g.append('circle')
        .attr('cx', cx).attr('cy', cy)
        .attr('r', R)
        .attr('fill', isActive ? '#1A2235' : '#111827')
        .attr('stroke', color)
        .attr('stroke-width', isActive ? 2.5 : 1.5);

      // Progress arc
      const arcGen = d3.arc<{ value: number }>()
        .innerRadius(R - 6)
        .outerRadius(R - 2)
        .startAngle(-Math.PI / 2)
        .endAngle(d => -Math.PI / 2 + d.value * 2 * Math.PI);

      g.append('path')
        .datum({ value: ns.p_pass })
        .attr('d', arcGen as any)
        .attr('fill', color)
        .attr('transform', `translate(${cx},${cy})`);

      // Percentage label
      g.append('text')
        .attr('x', cx).attr('y', cy - 3)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', color)
        .attr('font-size', '11px')
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('font-weight', '600')
        .text(`${(ns.p_pass * 100).toFixed(0)}%`);

      // Node label below
      const label = NODE_LABELS[ns.name];
      const words = label.split(' ');
      words.forEach((word, i) => {
        g.append('text')
          .attr('x', cx)
          .attr('y', cy + R + 14 + i * 13)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94A3B8')
          .attr('font-size', '10px')
          .attr('font-family', 'IBM Plex Sans, sans-serif')
          .text(word);
      });
    }
  }, [nodeStates, activeNode, onNodeClick]);

  return (
    <svg
      ref={svgRef}
      style={{ width: '100%', height: '380px', display: 'block' }}
    />
  );
}
