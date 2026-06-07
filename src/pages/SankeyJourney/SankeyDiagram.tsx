import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey as d3Sankey, sankeyLinkHorizontal, type SankeyGraph } from 'd3-sankey';
import type { SankeyData } from '@/api/analytics';

interface SankeyNode {
  id: number;
  name: string;
  pass_rate: number;
  total: number;
}

interface SankeyLink {
  source: number;
  target: number;
  value: number;
  pass_rate: number;
}

interface TooltipState {
  x: number;
  y: number;
  content: string;
  type: 'node' | 'link';
}

// Color by pass rate
function passRateColor(rate: number): string {
  if (rate >= 80) return '#4ADE80';
  if (rate >= 60) return '#FBBF24';
  if (rate >= 40) return '#FB923C';
  return '#F87171';
}

function terminalNodeColor(name: string): string {
  if (name === 'VERIFIED')     return '#4ADE80';
  if (name === 'NOT VERIFIED') return '#F87171';
  return '#00B4D8';
}

export function SankeyDiagram({ data }: { data: SankeyData }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data?.nodes?.length) return;

    const el    = svgRef.current;
    const W     = el.clientWidth || 860;
    const H     = 480;
    const PAD   = { top: 20, right: 180, bottom: 20, left: 20 };

    d3.select(el).selectAll('*').remove();

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H);

    // Defs for gradients
    const defs = svg.append('defs');

    const sankeyLayout = d3Sankey<SankeyNode, SankeyLink>()
      .nodeId(d => d.id)
      .nodeWidth(18)
      .nodePadding(20)
      .extent([[PAD.left, PAD.top], [W - PAD.right, H - PAD.bottom]]);

    // Build graph
    const graph: SankeyGraph<SankeyNode, SankeyLink> = sankeyLayout({
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.links.map(l => ({ ...l })),
    });

    // Draw links
    const linkGroup = svg.append('g').attr('class', 'links');

    graph.links.forEach((link, i) => {
      const srcNode  = link.source as SankeyNode & { x0: number; x1: number; y0: number; y1: number };
      const tgtNode  = link.target as SankeyNode & { x0: number; x1: number; y0: number; y1: number };
      const gradId   = `link-grad-${i}`;
      const srcColor = passRateColor((link.source as SankeyNode).pass_rate ?? 50);
      const tgtColor = passRateColor((link.target as SankeyNode).pass_rate ?? 50);

      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', srcNode.x1).attr('y1', 0)
        .attr('x2', tgtNode.x0).attr('y2', 0);

      grad.append('stop').attr('offset', '0%').attr('stop-color', srcColor).attr('stop-opacity', 0.5);
      grad.append('stop').attr('offset', '100%').attr('stop-color', tgtColor).attr('stop-opacity', 0.3);

      const path = linkGroup.append('path')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .attr('d', sankeyLinkHorizontal()(link as any) as string)
        .attr('fill', 'none')
        .attr('stroke', `url(#${gradId})`)
        .attr('stroke-width', Math.max(1, (link as { width?: number }).width ?? 1))
        .attr('stroke-opacity', 0.6)
        .style('cursor', 'pointer')
        .style('transition', 'stroke-opacity 0.2s');

      path
        .on('mouseenter', function(event: MouseEvent) {
          d3.select(this).attr('stroke-opacity', 1);
          const srcName = (link.source as SankeyNode).name;
          const tgtName = (link.target as SankeyNode).name;
          const l = link as SankeyLink & { value: number; pass_rate: number };
          setTooltip({
            x: event.offsetX, y: event.offsetY,
            type: 'link',
            content: `${srcName} → ${tgtName}\n${l.value.toLocaleString()} flows · ${l.pass_rate?.toFixed(1)}% verified`,
          });
        })
        .on('mouseleave', function() {
          d3.select(this).attr('stroke-opacity', 0.6);
          setTooltip(null);
        });
    });

    // Draw nodes
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    graph.nodes.forEach(node => {
      const n = node as SankeyNode & { x0: number; x1: number; y0: number; y1: number };
      const color = n.name === 'VERIFIED' || n.name === 'NOT VERIFIED'
        ? terminalNodeColor(n.name)
        : passRateColor(n.pass_rate);

      const g = nodeGroup.append('g').style('cursor', 'pointer');

      // Node rect
      g.append('rect')
        .attr('x', n.x0)
        .attr('y', n.y0)
        .attr('width', n.x1 - n.x0)
        .attr('height', Math.max(4, n.y1 - n.y0))
        .attr('fill', color)
        .attr('rx', 3)
        .attr('opacity', 0.9)
        .style('filter', `drop-shadow(0 0 6px ${color}80)`);

      // Node label
      const labelRight = n.x1 > W * 0.7;
      g.append('text')
        .attr('x', labelRight ? n.x0 - 8 : n.x1 + 8)
        .attr('y', (n.y0 + n.y1) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', labelRight ? 'end' : 'start')
        .attr('fill', '#CBD5E1')
        .attr('font-size', 11)
        .attr('font-family', 'IBM Plex Sans, sans-serif')
        .attr('font-weight', 500)
        .text(n.name);

      // Pass rate badge
      g.append('text')
        .attr('x', labelRight ? n.x0 - 8 : n.x1 + 8)
        .attr('y', (n.y0 + n.y1) / 2 + 14)
        .attr('dy', '0.35em')
        .attr('text-anchor', labelRight ? 'end' : 'start')
        .attr('fill', color)
        .attr('font-size', 10)
        .attr('font-family', 'JetBrains Mono, monospace')
        .text(n.total > 0 ? `${n.pass_rate.toFixed(1)}% · ${n.total.toLocaleString()}` : '');

      g.on('mouseenter', function(event: MouseEvent) {
        setTooltip({
          x: event.offsetX, y: event.offsetY,
          type: 'node',
          content: `${n.name}\nTotal: ${n.total.toLocaleString()}\nVerified: ${n.pass_rate.toFixed(1)}%`,
        });
      }).on('mouseleave', () => setTooltip(null));
    });

  }, [data]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        style={{ width: '100%', height: 480, display: 'block' }}
      />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top: tooltip.y - 10,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: '#E2E8F0',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'pre-line',
          lineHeight: 1.7,
          boxShadow: 'var(--shadow-card)',
          maxWidth: 240,
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
