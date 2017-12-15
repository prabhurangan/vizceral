/**
 *
 *  Copyright 2016 Netflix, Inc.
 *
 *     Licensed under the Apache License, Version 2.0 (the "License");
 *     you may not use this file except in compliance with the License.
 *     You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 *     Unless required by applicable law or agreed to in writing, software
 *     distributed under the License is distributed on an "AS IS" BASIS,
 *     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *     See the License for the specific language governing permissions and
 *     limitations under the License.
 *
 */
/* eslint no-restricted-syntax: 0 */
import Graph from './ltrTreeGraph';
import AcyclicFAS from './acyclicFAS';
import Ranker from './ranker';

const weightSort = function (a, b) {
  if (a.weight === b.weight) { return 0; }
  if (a.weight === undefined || a.weight < b.weight) { return 1; }
  return -1;
};

(function () {
  const LTRTreeLayouter = (function () {
    const ltrTreeLayouter = function () {};
    // TODO: Make layout deterministic

    function sortNodesByDepth (graph) {
      // Build the map of nodes to their levels
      let nodesSortedByDepth = [];
      let index;
      for (index in graph.nodes) {
        if ({}.hasOwnProperty.call(graph.nodes, index)) {
          const node = graph.nodes[index];
          nodesSortedByDepth[node.rank] = nodesSortedByDepth[node.rank] || [];
          nodesSortedByDepth[node.rank].push(node);
        }
      }

      // Remove empty ranks (and normalize to base 0)
      nodesSortedByDepth = nodesSortedByDepth.reduce((a, n) => { a.push(n); return a; }, []);

      const maxNodesPerDepth = 30;
      console.log('******maxnodes depth: ', maxNodesPerDepth);
      for (let i = 0; i < nodesSortedByDepth.length; i++) {
        const nodesInDepth = nodesSortedByDepth[i];
        if (nodesInDepth.length > maxNodesPerDepth) {
          const nodesToKeep = Math.min((nodesInDepth.length / 2) - 1, maxNodesPerDepth);
          const newNodeDepth = nodesInDepth.splice(nodesToKeep);
          nodesSortedByDepth.splice(i + 1, 0, newNodeDepth);
        }
      }

      return nodesSortedByDepth;
    }

    function sortNodesWithinDepth (nodesSortedByDepth) {
      for (let i = 0; i < nodesSortedByDepth.length; i++) {
        const nodesAtDepth = nodesSortedByDepth[i];
        const newNodesAtDepth = [];
        nodesAtDepth.sort(weightSort);

        // Heaviest in the middle, lightest to the outside
        for (let j = nodesAtDepth.length - 1; j >= 0; j--) {
          if (j % 2) {
            newNodesAtDepth.push(nodesAtDepth[j]);
          } else {
            newNodesAtDepth.unshift(nodesAtDepth[j]);
          }
        }
        nodesSortedByDepth[i] = newNodesAtDepth;
      }
    }

    function positionNodes (nodesSortedByDepth, dimensions) {
      const nodePositions = {};
      let lastXDelta = 0;
      let xOffset = 0;

      function setPositions (row, nodesAtDepth, yDelta) {
        const curYDelta = yDelta * row;
        const xDelta = dimensions.width / (nodesAtDepth.length + 1);
        console.log(`${curYDelta}    xdelta: ${xDelta}`);
        const needsXOffset = xDelta < lastXDelta ? lastXDelta % xDelta < 1 : xDelta % lastXDelta < 1;
        if (needsXOffset) { xOffset = -xOffset; }

        for (let j = 0; j < nodesAtDepth.length; j++) {
          const curXDelta = (xDelta * (j + 1)) + (needsXOffset ? xOffset : 0);
          nodePositions[nodesAtDepth[j].name] = { y: curYDelta, x: curXDelta };
        }

        lastXDelta = xDelta;
      }
      console.log(`${dimensions.width}  height:  ${dimensions.height}`);
      let yDelta;
      if (nodesSortedByDepth.length === 1) {
        yDelta = dimensions.height / 2;
        setPositions(1, nodesSortedByDepth[0], yDelta);
      } else {
        yDelta = dimensions.height / (nodesSortedByDepth.length - 1);
        console.log(`length: ${nodesSortedByDepth.length}`);
        const nodeLength = nodesSortedByDepth.length - 1;
        for (let i = 0; i < nodesSortedByDepth.length; i++) {
          console.log(`${i} yDelta: ${yDelta}`);
          console.log(`length2: ${nodesSortedByDepth[i].length}`);
          setPositions(nodeLength - i, nodesSortedByDepth[i], yDelta);
        }
      }

      return nodePositions;
    }

    ltrTreeLayouter.prototype.layout = function (data) {
      const options = data.options || {};
      const graph = new Graph(data.graph.nodes, data.graph.edges); // Build a simple graph object
      graph.removeSameEdges(); // Remove edges that have same source and target
      AcyclicFAS.remove(graph); // Remove acyclic links
      Ranker.longestPathRanking(graph); // Run a longest path algorithm to build a layout baseline
      // TODO: Rank the nodes from the dropped same edges...

      AcyclicFAS.restore(graph); // Restore acyclic links
      graph.restoreSameEdges(); // Replace edges that have same source and target

      Ranker.normalizeRanks(graph); // Normalize node ranks to be 0++
      if (!options.noRankPromotion) {
        Ranker.forcePrimaryRankPromotions(graph, data.entryNode); // Force all entry nodes to be first
        Ranker.forceSecondaryRankPromotions(graph, data.entryNode); // Force any leafs that are one level deep from specified entry node to not move all the way to the edge
      }

      const nodesSortedByDepth = sortNodesByDepth(graph);
      sortNodesWithinDepth(nodesSortedByDepth);
      const nodePositions = positionNodes(nodesSortedByDepth, data.dimensions);
      return nodePositions;
    };

    return ltrTreeLayouter;
  }());

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = LTRTreeLayouter;
  } else if (self !== undefined) {
    self.LTRTreeLayouter = LTRTreeLayouter;
  } else {
    window.LTRTreeLayouter = LTRTreeLayouter;
  }
}());

/*
nodes: [
  {
    name: 'nodename',
    position: [ 0, 0 ]  // optional
    depth: 2  // computed
  }
]
edges: [
  {
    source: 'nodename',
    target: 'nodename'
  }
]
*/
