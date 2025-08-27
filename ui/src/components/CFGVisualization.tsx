import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { GraphLayoutEngine, GraphUtils, type LayoutNode, type LayoutEdge } from '@/utils/graphUtils';
import type { CFGVisualizationProps, VisualizationSettings } from '@/types/analysis';

const CFGVisualization: React.FC<CFGVisualizationProps> = ({
  cfg,
  settings,
  onNodeClick,
  highlightedNode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const layoutEngine = useRef(new GraphLayoutEngine());

  // Update dimensions on container resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 800,
          height: rect.height || 600
        });
      }
    };

    updateDimensions();
    
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Render the CFG visualization
  const renderVisualization = useCallback(() => {
    if (!svgRef.current || !cfg.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    // Set up SVG dimensions
    svg.attr('width', dimensions.width).attr('height', dimensions.height);

    // Create main group for zoom/pan
    const mainGroup = svg.append('g').attr('class', 'main-group');

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        mainGroup.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Get layout based on settings
    let layoutData: { nodes: LayoutNode[]; edges: LayoutEdge[]; simulation?: d3.Simulation<LayoutNode, LayoutEdge> };

    const options = {
      width: dimensions.width,
      height: dimensions.height,
      nodeRadius: settings.nodeSize,
      linkDistance: 100,
      linkStrength: 0.3,
      chargeStrength: -300,
      centerForce: 0.1
    };

    switch (settings.layout) {
      case 'hierarchical':
        layoutData = layoutEngine.current.getHierarchicalLayout(cfg, options);
        break;
      case 'circular':
        layoutData = layoutEngine.current.getCircularLayout(cfg, options);
        break;
      case 'force':
      default:
        layoutData = layoutEngine.current.getForceLayout(cfg, options);
        break;
    }

    const { nodes, edges, simulation } = layoutData;

    // Create arrow markers for edges
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8 + settings.nodeSize)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    // Draw edges
    const edgeGroup = mainGroup.append('g').attr('class', 'edges');
    const edgeElements = edgeGroup.selectAll('.edge')
      .data(edges)
      .enter()
      .append('line')
      .attr('class', 'edge')
      .attr('stroke', d => GraphUtils.getEdgeColor(d))
      .attr('stroke-width', settings.edgeWidth)
      .attr('marker-end', 'url(#arrowhead)')
      .attr('opacity', 0.7);

    // Draw dominance edges if enabled
    if (settings.showDominance) {
      const dominanceGroup = mainGroup.append('g').attr('class', 'dominance-edges');
      
      // Create dominance edges from node data
      const dominanceEdges: Array<{ source: string; target: string }> = [];
      nodes.forEach(node => {
        node.dominance.dominators.forEach(domId => {
          if (domId !== node.id) {
            dominanceEdges.push({ source: domId, target: node.id });
          }
        });
      });

      dominanceGroup.selectAll('.dominance-edge')
        .data(dominanceEdges)
        .enter()
        .append('line')
        .attr('class', 'dominance-edge')
        .attr('stroke', '#9333ea')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('opacity', 0.3);
    }

    // Draw nodes
    const nodeGroup = mainGroup.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');

    // Node circles
    nodeElements.append('circle')
      .attr('r', settings.nodeSize)
      .attr('fill', d => GraphUtils.getNodeColor(d))
      .attr('stroke', d => d.id === highlightedNode ? '#000' : '#fff')
      .attr('stroke-width', d => d.id === highlightedNode ? 3 : 2)
      .attr('opacity', d => d.id === highlightedNode ? 1 : 0.8);

    // Node labels
    if (settings.showLabels) {
      nodeElements.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', '12px')
        .attr('font-family', 'monospace')
        .attr('fill', '#fff')
        .attr('pointer-events', 'none')
        .text(d => GraphUtils.formatNodeLabel(d));
    }

    // Node click handler
    nodeElements.on('click', (event, d) => {
      event.stopPropagation();
      onNodeClick?.(d.id);
    });

    // Add tooltips
    nodeElements.append('title')
      .text(d => {
        const lines = [
          `Node: ${d.id}`,
          `Type: ${d.type}`,
          `Statements: ${d.statements.length}`,
          `Predecessors: ${d.predecessors.length}`,
          `Successors: ${d.successors.length}`
        ];
        
        if (d.dominance.dominators.length > 0) {
          lines.push(`Dominators: ${d.dominance.dominators.join(', ')}`);
        }
        
        return lines.join('\n');
      });

    // Update positions for force simulation
    if (simulation) {
      const updatePositions = () => {
        edgeElements
          .attr('x1', d => (d.source as LayoutNode).x!)
          .attr('y1', d => (d.source as LayoutNode).y!)
          .attr('x2', d => (d.target as LayoutNode).x!)
          .attr('y2', d => (d.target as LayoutNode).y!);

        if (settings.showDominance) {
          const nodeMap = new Map(nodes.map(n => [n.id, n]));
          dominanceGroup.selectAll('.dominance-edge')
            .attr('x1', (d: any) => nodeMap.get(d.source)?.x ?? 0)
            .attr('y1', (d: any) => nodeMap.get(d.source)?.y ?? 0)
            .attr('x2', (d: any) => nodeMap.get(d.target)?.x ?? 0)
            .attr('y2', (d: any) => nodeMap.get(d.target)?.y ?? 0);
        }

        nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
      };

      simulation.on('tick', updatePositions);
      simulation.restart();

      // Cleanup simulation on unmount
      return () => {
        simulation.stop();
      };
    } else {
      // Static layout - set positions immediately
      edgeElements
        .attr('x1', d => (d.source as LayoutNode).x!)
        .attr('y1', d => (d.source as LayoutNode).y!)
        .attr('x2', d => (d.target as LayoutNode).x!)
        .attr('y2', d => (d.target as LayoutNode).y!);

      if (settings.showDominance) {
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        dominanceGroup.selectAll('.dominance-edge')
          .attr('x1', (d: any) => nodeMap.get(d.source)?.x ?? 0)
          .attr('y1', (d: any) => nodeMap.get(d.source)?.y ?? 0)
          .attr('x2', (d: any) => nodeMap.get(d.target)?.x ?? 0)
          .attr('y2', (d: any) => nodeMap.get(d.target)?.y ?? 0);
      }

      nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
    }

    // Fit to view
    const fitToView = () => {
      const bounds = mainGroup.node()?.getBBox();
      if (!bounds) return;

      const padding = 50;
      const scale = Math.min(
        (dimensions.width - padding) / bounds.width,
        (dimensions.height - padding) / bounds.height,
        1
      );

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const translateX = dimensions.width / 2 - scale * centerX;
      const translateY = dimensions.height / 2 - scale * centerY;

      svg.transition()
        .duration(750)
        .call(
          zoom.transform,
          d3.zoomIdentity.translate(translateX, translateY).scale(scale)
        );
    };

    // Fit to view after initial layout
    setTimeout(fitToView, 100);

  }, [cfg, dimensions, settings, highlightedNode, onNodeClick]);

  // Re-render when dependencies change
  useEffect(() => {
    renderVisualization();
  }, [renderVisualization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      layoutEngine.current.cleanup();
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-gray-50 rounded-lg border"
    >
      <svg 
        ref={svgRef}
        className="w-full h-full"
        style={{ minHeight: '400px' }}
      />
      
      {/* Graph metrics overlay */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg">
        <div className="space-y-1">
          <div>Nodes: {cfg.nodes.length}</div>
          <div>Edges: {cfg.edges.length}</div>
          {cfg.nodes.length > 0 && (
            <div>
              Density: {(
                (cfg.edges.length / (cfg.nodes.length * (cfg.nodes.length - 1))) * 100
              ).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs shadow-lg">
        <div className="space-y-2">
          <div className="font-medium">Node Types</div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
            <span>Entry</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <span>Exit</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span>Branch</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-purple-400"></div>
            <span>Merge</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span>Basic Block</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CFGVisualization;