document.addEventListener('DOMContentLoaded', function () {
    // 1. Get Data Safely
    const dataScript = document.getElementById('chart-data');
    let scoreData = [];
    if (dataScript) {
        try {
            scoreData = JSON.parse(dataScript.textContent || '[]');
        } catch (e) {
            console.error('Failed to parse chart data', e);
        }
    }

    // 2. Toggle Logic
    initTogglePanel();

    // 3. Render Chart
    if (!scoreData || scoreData.length === 0) {
        const noDataEl = document.getElementById('no-data');
        if (noDataEl) noDataEl.classList.remove('hidden');
    } else {
        renderChart(scoreData);
    }
});

function initTogglePanel() {
    const toggleBtn = document.getElementById('toggle-settings');
    const content = document.getElementById('settings-content');
    const panel = document.getElementById('settings-panel');

    if (toggleBtn && content && panel) {
        // Icons
        const iconShow = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>`;
        const iconHide = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;

        // Initial State: Visible -> Button shows Hide icon
        toggleBtn.innerHTML = iconHide;

        toggleBtn.addEventListener('click', () => {
            // Check if minimized
            const isHidden = content.classList.contains('max-h-0');

            if (isHidden) {
                // Show (Expand)
                content.classList.remove('max-h-0', 'opacity-0', 'p-0');
                content.classList.add('max-h-[600px]', 'opacity-100', 'p-4');

                panel.classList.remove('w-12');
                panel.classList.add('w-80');

                toggleBtn.innerHTML = iconHide;
            } else {
                // Hide (Collapse)
                content.classList.remove('max-h-[600px]', 'opacity-100', 'p-4');
                content.classList.add('max-h-0', 'opacity-0', 'p-0');

                panel.classList.remove('w-80');
                panel.classList.add('w-12');

                toggleBtn.innerHTML = iconShow;
            }
        });
    }
}

function renderChart(data) {
    // 1. Setup Container
    const container = document.getElementById('chart-container');
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Remove previous svg if any
    d3.select(container).selectAll('svg').remove();

    // 2. Prepare Data (Stratify)
    const ids = new Set(data.map(d => d.customer_citizen_id));
    const roots = data.filter(d => !d.recommender_id || !ids.has(d.recommender_id));
    let hierarchyData;
    if (roots.length > 1) {
        const fakeRoot = {
            customer_citizen_id: "GenericRoot",
            customer_name: "Organization",
            recommender_id: null,
            isFake: true
        };
        const adjustedData = [fakeRoot, ...data.map(d => {
            if (!d.recommender_id || !ids.has(d.recommender_id)) {
                return { ...d, recommender_id: "GenericRoot" };
            }
            return d;
        })];
        hierarchyData = adjustedData;
    } else if (roots.length === 1) {
        const rootId = roots[0].customer_citizen_id;
        hierarchyData = data.map(d => {
            if (d.customer_citizen_id === rootId) return { ...d, recommender_id: null };
            return d;
        });
    } else {
        const noDataEl = document.getElementById('no-data');
        if (noDataEl) noDataEl.classList.remove('hidden');
        return;
    }

    // 3. D3 Tree Layout (Vertical, collapsible)
    try {
        const root = d3.stratify()
            .id(d => d.customer_citizen_id)
            .parentId(d => d.recommender_id)
            (hierarchyData);

        // ไม่ collapse node ใดๆ เพื่อให้แสดง node ทั้งหมดตั้งแต่เริ่มต้น

        // Assigns the x and y position for the nodes
        const treeLayout = d3.tree().nodeSize([300, 100]); // [vertical, horizontal]
        root.x0 = height / 2;
        root.y0 = 0;

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(d3.zoom().on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g")
            .attr("transform", `translate(80,${height / 2})`);

        update(root);

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        // สี Node ตามที่ผู้ใช้กำหนด
        function getPosition(d) {
            return (d.data.customer_position || d.data.customerPosition || d.data.afterPosition || d.data.position || '').toUpperCase();
        }
        function nodeStrokeColor(d) {
            const pos = getPosition(d);
            if (pos === 'SFAG') return '#a67e18';
            if (pos === 'SAG' || pos === 'ESAG') return '#a93226';
            if (pos === 'BM') return '#4682B4';
            if (pos === 'AG') return '#259a25';
            return '#1976d2';
        }
        function nodeFillColor(d) {
            const pos = getPosition(d);
            if (pos === 'SFAG') return '#FFD700';
            if (pos === 'SAG' || pos === 'ESAG') return '#f5b7b1';
            if (pos === 'BM') return '#ADD8E6';
            if (pos === 'AG') return '#90EE90';
            return '#fff';
        }

        function update(source) {
            // Compute the new tree layout.
            const treeData = treeLayout(root);
            const nodes = treeData.descendants();
            const links = treeData.links();

            // Normalize for fixed-depth (vertical tree)
            nodes.forEach(d => d.y = d.depth * 220);

            // Remove old nodes/links
            g.selectAll('.link').remove();
            g.selectAll('.node').remove();

            // Render Links
            g.selectAll('.link')
                .data(links, d => d.target.id)
                .enter().append('path')
                .attr('class', 'link')
                .attr('d', d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y))
                .attr('fill', 'none')
                .attr('stroke', '#ccc')
                .attr('stroke-width', 2);

            // Render Nodes
            const node = g.selectAll('.node')
                .data(nodes, d => d.id)
                .enter().append('g')
                .attr('class', 'node')
                .attr('transform', d => `translate(${d.x},${d.y})`)
                .on('click', function (event, d) {
                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else if (d._children) {
                        d.children = d._children;
                        d._children = null;
                    }
                    update(d);
                });

            // Node Circle (collapsible) - ปรับสีตามที่ผู้ใช้กำหนด
            node.append('circle')
                .attr('r', 24)
                .attr('fill', d => d.data.isFake ? 'none' : nodeFillColor(d))
                .attr('stroke', d => d.data.isFake ? 'none' : nodeStrokeColor(d))
                .attr('stroke-width', d => d.data.isFake ? 0 : 3);

            // Node label: expand/collapse icon
            node.filter(d => !d.data.isFake && (d.children || d._children)).append('text')
                .attr('x', 0)
                .attr('y', 6)
                .attr('text-anchor', 'middle')
                .attr('font-size', '22px')
                .attr('fill', '#fff')
                .attr('pointer-events', 'none')
                .text(d => d.children ? '-' : '+');

            // Node info box (right of node)
            const infoGroup = node.filter(d => !d.data.isFake).append('g')
                .attr('transform', 'translate(40,-30)');

            infoGroup.append('rect')
                .attr('width', 180)
                .attr('height', 80)
                .attr('rx', 8)
                .attr('fill', '#fff')
                .attr('stroke', '#e5e7eb')
                .attr('stroke-width', 1.5)
                .attr('filter', 'drop-shadow(1px 1px 2px rgba(0,0,0,0.07))');

            infoGroup.append('text')
                .attr('x', 12)
                .attr('y', 18)
                .attr('font-size', '15px')
                .attr('font-weight', 'bold')
                .attr('fill', '#111827')
                .text(d => d.data.customer_name);

            // สีของ (position) ใน label ใช้สีน้ำเงินเหมือนกันทั้งหมด
            infoGroup.append('text')
                .attr('x', 12)
                .attr('y', 36)
                .attr('font-size', '13px')
                .attr('fill', '#1976d2')
                .text(d => `(${d.data.customer_position || '-'})`);

            infoGroup.append('text')
                .attr('x', 12)
                .attr('y', 52)
                .attr('font-size', '13px')
                .attr('fill', '#6b7280')
                .text(d => `คะแนนส่วนตัว: ${d.data.self_private_score?.toLocaleString()}`);

            infoGroup.append('text')
                .attr('x', 12)
                .attr('y', 68)
                .attr('font-size', '13px')
                .attr('fill', '#059669')
                .attr('font-weight', '600')
                .text(d => `คะแนนรวม: ${d.data.total_score?.toLocaleString()}`);
        }
    } catch (e) {
        console.error(e);
        const noDataEl = document.getElementById('no-data');
        if (noDataEl) {
            noDataEl.textContent = "เกิดข้อผิดพลาดในการแสดงแผนผัง: " + e.message;
            noDataEl.classList.remove('hidden');
        }
    }
}
