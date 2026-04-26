'use strict';

const STREAMS = [
    { id: 'high',        label: 'High',        tagClass: 'tag-high'        },
    { id: 'medium',      label: 'Medium',      tagClass: 'tag-medium'      },
    { id: 'low',         label: 'Low',         tagClass: 'tag-low'         },
    { id: 'best-effort', label: 'Best Effort', tagClass: 'tag-best-effort' },
];

let pollTimer = null;

function bwToBps(value, unit) {
    return unit === 'kbps' ? value * 1000 : value * 1_000_000;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function getSelectedStreams() {
    const result = [];
    for (const s of STREAMS) {
        if (!document.getElementById(`check-${s.id}`).checked) continue;
        const bw = parseFloat(document.getElementById(`bw-${s.id}`).value);
        const unit = document.getElementById(`unit-${s.id}`).value;
        if (!bw || bw <= 0) {
            alert(`Invalid bandwidth for ${s.label}.`);
            return null;
        }
        result.push({ name: s.label, priority: s.id, bandwidth_bps: bwToBps(bw, unit) });
    }
    return result;
}

function setFormDisabled(disabled) {
    for (const s of STREAMS) {
        document.getElementById(`check-${s.id}`).disabled = disabled;
        document.getElementById(`bw-${s.id}`).disabled = disabled;
        document.getElementById(`unit-${s.id}`).disabled = disabled;
    }
    document.getElementById('start-btn').disabled = disabled;
    document.getElementById('stop-btn').disabled = !disabled;
}

function applyStatus(data) {
    const running = data.running;
    const dot = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    const countdown = document.getElementById('countdown');
    const countdownVal = document.getElementById('countdown-value');
    const activeRow = document.getElementById('active-streams-row');
    const activeList = document.getElementById('active-streams-list');

    if (running) {
        dot.className = 'status-dot running';
        label.textContent = 'Running';
        label.className = 'status-label running';
        countdown.style.display = 'flex';
        countdownVal.textContent = formatTime(data.remaining);

        // Active stream tags
        if (data.active_streams && data.active_streams.length > 0) {
            activeRow.style.display = 'block';
            activeList.innerHTML = data.active_streams.map(name => {
                const s = STREAMS.find(x => x.label === name);
                const cls = s ? s.tagClass : 'tag-high';
                return `<span class="stream-tag ${cls}">${name}</span>`;
            }).join('');
        }
    } else {
        dot.className = 'status-dot';
        label.textContent = 'Idle';
        label.className = 'status-label';
        countdown.style.display = 'none';
        activeRow.style.display = 'none';

        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    }

    setFormDisabled(running);
}

async function fetchStatus() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        applyStatus(data);
    } catch (e) {
        console.error('Status fetch error:', e);
    }
}

async function startTraffic() {
    const streams = getSelectedStreams();
    if (!streams) return;
    if (streams.length === 0) {
        alert('Please select at least one stream.');
        return;
    }

    try {
        const res = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ streams }),
        });

        if (res.ok) {
            applyStatus({ running: true, remaining: 300, active_streams: streams.map(s => s.name) });
            pollTimer = setInterval(fetchStatus, 1000);
        } else {
            const err = await res.json();
            alert(`Error: ${err.error}`);
        }
    } catch (e) {
        alert(`Request failed: ${e.message}`);
    }
}

async function stopTraffic() {
    try {
        await fetch('/api/stop', { method: 'POST' });
    } catch (e) {
        console.error('Stop failed:', e);
    }
}

async function loadDestinations() {
    const list = document.getElementById('destinations-list');
    list.innerHTML = '<span class="loading-text">Loading...</span>';
    try {
        const res = await fetch('/api/config');
        const data = await res.json();

        if (data.error) {
            list.innerHTML = `<span class="error-text">Config error: ${data.error}</span>`;
            return;
        }

        list.innerHTML = data.destinations.map(d => `
            <div class="dest-card">
                <div class="dest-name">${d.name}</div>
                <div class="dest-addr">${d.ip}:${d.port}</div>
            </div>
        `).join('');
    } catch (e) {
        list.innerHTML = '<span class="error-text">Failed to load config.</span>';
    }
}

document.getElementById('start-btn').addEventListener('click', startTraffic);
document.getElementById('stop-btn').addEventListener('click', stopTraffic);

fetchStatus();
loadDestinations();
