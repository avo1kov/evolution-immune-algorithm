function renderGraph(graph, solution) {
    var svg = d3.select("svg"),
        width = window.innerWidth,
        height = window.innerHeight - 100;

    var color = d3.scaleOrdinal(d3.schemeCategory20);

    var simulation = d3.forceSimulation()
        .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(30).strength(1))
        .force("charge", d3.forceManyBody())
        .force('collide', d3.forceCollide(50))
        .force("center", d3.forceCenter(width / 2, height / 2));

    var link = svg.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(graph.links)
        .enter().append("line")
        .attr("id", function(d) { return `link-${d.value}`; })
        .attr("class", function(d){
            if (solution.includes(d)) {
                return 'red';
            }
            return 'gray';
        });

    var node = svg.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(graph.nodes)
        .enter().append("g");

    node.append("circle")
        .attr("r", 5);

    var drag_handler = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    drag_handler(node);

    node.append("text")
        .text(function(d) {
            return parseInt(d.id) + 1;
        })
        .attr('x', 6)
        .attr('y', 3);

    node.append("title")
        .text(function(d) { return d.id; });

    simulation
        .nodes(graph.nodes)
        .on("tick", ticked);

    simulation.force("link").links(graph.links);

    function ticked() {
        link
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            })
    }

    function dragstarted(d) {
        if (!d3.event.active) {
            simulation.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
    }

    function dragended(d) {
        if (!d3.event.active) {
            simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
    }
}

function rerenderGraph(graph, result) {
    for (let i = 0; i < graph.links.length; i++) {
        const linkElement = document.getElementById(`link-${i}`);
        linkElement.classList.remove('red', 'gray');
        linkElement.classList.add(result.includes(i) ? 'red' : 'gray');
    }
}

function getPositiveBitsAmount(arr) {
    return arr.reduce((number, char) => number + (char === '1'), 0);
}

function generate_antibodies(population, edges_num) {
    var antibodies = [];

    for (var i = 0; i < population; i++) {
        var antibody = (new Array(edges_num)).fill('0');
        var onesAmount = Math.round(Math.random() * (edges_num - 1) + 1);
        while (getPositiveBitsAmount(antibody) < onesAmount) {
            var index = Math.floor(Math.random() * edges_num);
            antibody[index] = '1';
        }
        antibodies.push(antibody);
    }

    return antibodies;
}

function get_cost(graph, antibody) {
    var edges = [...graph.links];
    var nodes = [...graph.nodes];
    var visitedVertexes = new Set();
    var usedEdgesAmount = 0;

    for (var [i, e] of antibody.entries()) {
        if (e === '1') {
            usedEdgesAmount += 1;
            var {source, target} = edges[i];
            visitedVertexes.add(target);
            visitedVertexes.add(source);
        }
    }

    return {cost: nodes.length - visitedVertexes.size, used_edges: usedEdgesAmount}
}

function argsort(array) {
    const arrayObject = array.map((value, idx) => { return { value, idx }; });
    arrayObject.sort((a, b) => {

        if (a.value < b.value) {
            return -1;
        }

        if (a.value > b.value) {
            return 1;
        }
        return 0;
    });

    const argIndices = arrayObject.map(data => data.idx);

    return argIndices;
}

function select_antibodies(graph, antibodies, pop_total) {
    var cluster = {};
    var edges = [...graph.links];
    for (var i = 0; i < edges.length + 2; i++) {
        cluster[i] = [];
    }

    var antibodies_costs = [];

    for (var [i, a] of antibodies.entries()) {
        const {cost, used_edges} = get_cost(graph, a);
        antibodies_costs.push([cost, used_edges]);
        cluster[cost].push(i);
    }

    var new_cluster = {};
    for (const cost in cluster) {
        if (cluster[cost].length > 0) {
            var score = [];
            for (var i of cluster[cost]) {
                score.push(antibodies[i].filter(a => a === '1').length);
            }
            
            var sorted_index = argsort(score);
            
            var output_lst = [];
            for (let i = 0; i < cluster[cost].length; i++) {
                output_lst.push(cluster[cost][sorted_index[i]]);
            }

            new_cluster[cost] = output_lst;
        }
    }
    cluster = new_cluster;
        
    var sorted_antibodies = [];
    for (var cost in cluster) {
        sorted_antibodies = [...sorted_antibodies, ...cluster[cost].map((x) => antibodies[x])];
        if (sorted_antibodies.length > pop_total) {
            break;
        }
    }

    return sorted_antibodies.slice(0, pop_total);
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
 
    return array;
} 

function clone_and_mutate(graph, antibodies, mutat_prob) {
    var edges = [...graph.links];
    var antibodies_len = antibodies.length;
    for (const [i, a] of antibodies.entries()) {
        for (let j = 0; j < antibodies_len - i; j++) {
            var clone = [...antibodies[i]];
            var mut_array = new Array(edges.length + 1)
                .join('0')
                .split('')
                .map(
                    (_, index) => index >= edges.length - Math.ceil(mutat_prob * edges.length) ? '1' : '0'
                );

            mut_array = shuffle(mut_array);

            for (let k = 0; k < clone.length; k++) {
                if (mut_array[k] === '1') {
                    clone[k] = clone[k] === '1' ? '0' : '1';
                }
            }

            antibodies.push(clone)
        }
    }
    return antibodies
}

function mfind(G, mutat_prob, pop_init, pop_total, max_iterate) {
    const edges = [...G.links];

    let antibodies = generate_antibodies(pop_init, edges.length);

    for (let i = 0; i < max_iterate; i++) {
        antibodies = select_antibodies(G, antibodies, pop_total);
        antibodies = clone_and_mutate(G, antibodies, mutat_prob);
    }
    antibodies = select_antibodies(G, antibodies, 5);

    const links = [], linksIndexes = [];
    for (let i = 0; i < antibodies[0].length; i++) {
        if (antibodies[0][i] === '1') {
            links.push(edges[i]);
            linksIndexes.push(i);
        }
    }

    return {links, linksIndexes};
}

function generateTree(nodesAmount) {
    var graph = {"nodes": [], "links": []};

    for (var i = 0; i < nodesAmount; i++) {
        graph.nodes.push({"id": i.toString(), "group": 1});
    }
    
    const usedNodes = [];
    let nextRoots = [0];
    while (usedNodes.length < nodesAmount) {
        const roots = [...nextRoots];
        nextRoots = [];
        for (let i = 0; i < roots.length; i++) {
            const root = roots[i];
            const childsCount = Math.round(Math.random() * 2) + 1;
            for (var j = 0; j < childsCount; j++) {
                let target = 0;
                while (usedNodes.includes(target) && target < nodesAmount) {
                    target++;
                }
                if (target >= nodesAmount) {
                    return graph;
                }
                usedNodes.push(target);
                nextRoots.push(target);
                graph.links.push({"source": root.toString(), "target": target.toString(), "value": graph.links.length});
            }
        }
    }

    return graph;
}

const space = document.getElementById('space');

const nodesCountInput = document.getElementById('nodes-count');
const regenerateButton = document.getElementById('regen-button');

const mutateProbInput = document.getElementById('mutat-prob');
const popInitInput = document.getElementById('pop-init');
const popTotalInput = document.getElementById('pop-total');
const maxIterateInput = document.getElementById('max-iterate');
const recalculateButton = document.getElementById('recalc-button');

const recLoader = document.getElementById('rec-loader');
const genLoader = document.getElementById('gen-loader');

function validateParsedValue(value, minValue, defaultValue) {
    if (!value || isNaN(value) || value < minValue) {
        return defaultValue;
    }
    return value;
}

function getParams() {
    const mutatProb = validateParsedValue(parseInt(mutateProbInput.value), 0, 0.2);
    const popInit = validateParsedValue(parseInt(popInitInput.value), 1, 10);
    const popTotal = validateParsedValue(parseInt(popTotalInput.value), 1, 10);
    const maxIterate = validateParsedValue(parseInt(maxIterateInput.value), 1, 50);
    const nodesCount = validateParsedValue(parseInt(nodesCountInput.value), 2, 14);
    return {mutatProb, popInit, popTotal, maxIterate, nodesCount};
}

let graph;
function start() {
    genLoader.classList.remove('transparent');
    setTimeout(() => {
        const {mutatProb, popInit, popTotal, maxIterate, nodesCount} = getParams();

        graph = generateTree(nodesCount);
        const result = mfind(graph, mutatProb, popInit, popTotal, maxIterate);
        renderGraph(graph, result.links);
        genLoader.classList.add('transparent');
    }, 100);
}

function restart() {
    space.innerHTML = '';
    start();
}

function recalculate() {
    recLoader.classList.remove('transparent');
    setTimeout(() => {
        const {mutatProb, popInit, popTotal, maxIterate} = getParams();

        const result = mfind(graph, mutatProb, popInit, popTotal, maxIterate);
        rerenderGraph(graph, result.linksIndexes);
        recLoader.classList.add('transparent');
    }, 100);
}

start();

regenerateButton.addEventListener('click', restart);

recalculateButton.addEventListener('click', recalculate);
