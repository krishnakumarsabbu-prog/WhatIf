import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { DriftHeatmapCell, DriftSeverity } from '@/api/drift';

interface Props {
  cells: DriftHeatmapCell[];
  selectedVar: string | null;
  onVarClick: (v: string) => void;
}

const SEV_COLORS: Record<DriftSeverity, string> = {
  STABLE:         '#1A3A2A',
  MONITOR:        '#3A2F0A',
  DRIFT_DETECTED: '#3A1A1A',
};
const SEV_TEXT: Record<DriftSeverity, string> = {
  STABLE:         '#4ADE80',
  MONITOR:        '#FCD34D',
  DRIFT_DETECTED: '#F87171',
};

const VAR_LABELS: Record<string, string> = {
  cmra_rate:       'CMRA Rate',
  pbsa_rate:       'PBSA Rate',
  koec0039_rate:   'KOEC0039',
  comm_error_rate: 'Comm Error',
  doc_fail_rate:   'Doc Fail',
  pass_rate:       'Verify Rate',
};

export function DriftHeatmap({ cells, selectedVar, onVarClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!cells.length) return;
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();

    const variables = [...new Set(cells.map(c => c.variable))];
    const dates     = [...new Set(cells.map(c => c.date))].sort();

    const marginLeft = 90;
    const marginTop  = 32;
    const cellW = 46;
    const cellH = 36;
    const W = marginLeft + dates.length * cellW + 10;
    const H = marginTop + variables.length * cellH + 10;

    svg.attr('width', W).attr('height', H);

    // Date labels
    svg.selectAll('.date-label')
      .data(dates)
      .enter().append('text')
      .attr('x', (d, i) => marginLeft + i * cellW + cellW / 2)
      .attr('y', marginTop - 8)
      .attr('text-anchor', 'middle')
      .attr('fill', '#475569')
      .attr('font-size', '9px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(d => d.slice(5)); // MM-DD

    // Row labels
    svg.selectAll('.var-label')
      .data(variables)
      .enter().append('text')
      .attr('x', marginLeft - 8)
      .attr('y', (d, i) => marginTop + i * cellH + cellH / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => d === selectedVar ? 'var(--accent-primary)' : '#94A3B8')
      .attr('font-size', '11px')
      .attr('font-family', 'IBM Plex Sans, sans-serif')
      .attr('cursor', 'pointer')
      .text(d => VAR_LABELS[d] ?? d)
      .on('click', (_, d) => onVarClick(d));

    // Cells
    const cellData = cells.filter(c => variables.includes(c.variable) && dates.includes(c.date));

    const cellGroups = svg.selectAll('.cell')
      .data(cellData)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('click', (_, d) => onVarClick(d.variable));

    cellGroups.append('rect')
      .attr('x', d => marginLeft + dates.indexOf(d.date) * cellW + 2)
      .attr('y', d => marginTop + variables.indexOf(d.variable) * cellH + 2)
      .attr('width', cellW - 4)
      .attr('height', cellH - 4)
      .attr('rx', 4)
      .attr('fill', d => d.variable === selectedVar ? SEV_COLORS[d.severity].replace('1A', '2A') : SEV_COLORS[d.severity])
      .attr('stroke', d => d.variable === selectedVar ? SEV_TEXT[d.severity] : 'transparent')
      .attr('stroke-width', 1);

    cellGroups.append('text')
      .attr('x', d => marginLeft + dates.indexOf(d.date) * cellW + cellW / 2)
      .attr('y', d => marginTop + variables.indexOf(d.variable) * cellH + cellH / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', d => SEV_TEXT[d.severity])
      .attr('font-size', '9px')
      .attr('font-family', 'JetBrains Mono, monospace')
      .text(d => d.psi.toFixed(2));
  }, [cells, selectedVar, onVarClick]);

  return (
    <div ref={containerRef} style={{ overflowX: 'auto' }}>
      <svg ref={svgRef} />
    </div>
  );
}
