// Initialize map
let map;
let markers = [];
let markerClusterGroup;
let allHikes = [];
let filteredHikes = [];
let maxLength = 100;
let currentTileLayer;
let osmTileLayer;
let hikingTileLayer;
let mapStyleMode = 'auto';
const HIKING_MAP_ZOOM_THRESHOLD = 12;
const DEFAULT_MAP_VIEW = { lat: 31.25, lng: 35.2, zoom: 7 };
const MAP_STYLE_MODES = new Set(['auto', 'israel', 'osm']);

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    initMap();
    loadHikes();
    setupEventListeners();
});

// Initialize Leaflet map
function initMap() {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat')) || DEFAULT_MAP_VIEW.lat;
    const lng = parseFloat(urlParams.get('lng')) || DEFAULT_MAP_VIEW.lng;
    const zoom = parseInt(urlParams.get('zoom')) || DEFAULT_MAP_VIEW.zoom;
    mapStyleMode = getMapStyleMode(urlParams.get('mapStyle'));
    document.getElementById('mapStyle').value = mapStyleMode;

    map = L.map('map').setView([lat, lng], zoom);

    // Add scale control
    L.control.scale({ imperial: false }).addTo(map);

    osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    if (window.maplibregl && maplibregl.setRTLTextPlugin) {
        maplibregl.setRTLTextPlugin(
            'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
            null,
            true // Lazy load the plugin only when text is in arabic/hebrew
        );
    }

    hikingTileLayer = L.maplibreGL({
        // style: 'https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/refs/heads/master/Styles/IHM.json',
        style: './IHM.json', // ⚠️ The remote style is broken (has value #00C00050 that doesn't work) so using local copy
        attribution: '© Israel Hiking Map'
    });

    // Keep the fast OSM layer visible while the detailed hiking style warms up.
    osmTileLayer.addTo(map);
    hikingTileLayer.addTo(map);
    applyMapStyle();

    // Keep automatic mode tied to the current zoom level.
    map.on('zoomend', function () {
        if (mapStyleMode === 'auto') {
            applyMapStyle();
        }
    });

    // Update URL when map moves
    map.on('moveend', function () {
        const center = map.getCenter();
        const currentZoom = map.getZoom();

        const params = new URLSearchParams(window.location.search);
        params.set('lat', center.lat.toFixed(5));
        params.set('lng', center.lng.toFixed(5));
        params.set('zoom', currentZoom);

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    });
}

function getMapStyleMode(value) {
    return MAP_STYLE_MODES.has(value) ? value : 'auto';
}

function applyMapStyle() {
    const layer = mapStyleMode === 'israel'
        ? hikingTileLayer
        : mapStyleMode === 'osm'
            ? osmTileLayer
            : map.getZoom() >= HIKING_MAP_ZOOM_THRESHOLD
                ? hikingTileLayer
                : osmTileLayer;

    if (currentTileLayer === layer) {
        return;
    }

    osmTileLayer.setOpacity(layer === osmTileLayer ? 1 : 0);
    hikingTileLayer.getContainer().style.opacity = layer === hikingTileLayer ? '1' : '0';
    currentTileLayer = layer;
}

function updateMapStyle(value) {
    mapStyleMode = getMapStyleMode(value);
    applyMapStyle();

    const params = new URLSearchParams(window.location.search);
    if (mapStyleMode === 'auto') {
        params.delete('mapStyle');
    } else {
        params.set('mapStyle', mapStyleMode);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Load hikes from JSON
async function loadHikes() {
    try {
        const response = await fetch('hikes.json');
        if (!response.ok) {
            throw new Error('Failed to load hikes.json');
        }
        allHikes = await response.json();
        filteredHikes = [...allHikes];

        // Calculate max length
        maxLength = Math.max(...allHikes.map(hike => hike.length || 0));
        maxLength = Math.ceil(maxLength / 5) * 5; // Round up to nearest 5

        // Set max values for range sliders
        document.getElementById('lengthMin').max = maxLength;
        document.getElementById('lengthMax').max = maxLength;
        document.getElementById('lengthMax').value = maxLength;

        // Update length display
        document.getElementById('lengthDisplay').textContent = `0 - ${maxLength}`;

        // Initialize mobile tabs on load
        const filtersTab = document.getElementById('filtersTab');
        if (filtersTab) {
            filtersTab.classList.add('active');
        }

        populateTagFilters();
        restoreFiltersFromUrl();

        displayHikes();
        updateRangeSliderTrack(false);

        // Only call updateMap if it hasn't been called yet during restore
        if (!mapAlreadyUpdated) {
            // Ensure map is ready before updating markers
            setTimeout(() => {
                updateMap();
            }, 100);
        }
    } catch (error) {
        console.error('Error loading hikes:', error);
        document.getElementById('hikesList').innerHTML = `
            <li style="padding: 20px; text-align: center; color: #666;">
                <p>לא ניתן לטעון נתוני טיולים</p>
                <p style="font-size: 12px; margin-top: 10px;">ודא כי hikes.json נמצא באותה תיקייה</p>
            </li>
        `;
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('lengthMin').addEventListener('change', applyFilters);
    document.getElementById('lengthMax').addEventListener('change', applyFilters);
    document.getElementById('lengthMin').addEventListener('input', applyFilters);
    document.getElementById('lengthMax').addEventListener('input', applyFilters);
    document.getElementById('lengthMin').addEventListener('input', () => syncLengthInput('min'));
    document.getElementById('lengthMax').addEventListener('input', () => syncLengthInput('max'));
    document.getElementById('lengthMinInput').addEventListener('change', () => syncRangeFromInput('min'));
    document.getElementById('lengthMaxInput').addEventListener('change', () => syncRangeFromInput('max'));
    document.getElementById('lengthMinInput').addEventListener('keydown', handleLengthInputKeydown);
    document.getElementById('lengthMaxInput').addEventListener('keydown', handleLengthInputKeydown);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('minimizeBtn').addEventListener('click', toggleSidebar);
    document.getElementById('expandBtn').addEventListener('click', toggleSidebar);
    document.getElementById('mapStyle').addEventListener('change', event => {
        updateMapStyle(event.target.value);
    });
}

function handleLengthInputKeydown(event) {
    if (event.key === 'Enter') {
        event.target.blur();
    }
}

function syncLengthInput(which) {
    const slider = document.getElementById(which === 'min' ? 'lengthMin' : 'lengthMax');
    const input = document.getElementById(which === 'min' ? 'lengthMinInput' : 'lengthMaxInput');
    input.value = slider.value;
    updateRangeSliderTrack(which === 'min');
}

function syncRangeFromInput(which) {
    const slider = document.getElementById(which === 'min' ? 'lengthMin' : 'lengthMax');
    const input = document.getElementById(which === 'min' ? 'lengthMinInput' : 'lengthMaxInput');
    const value = Math.max(0, Math.min(maxLength, parseFloat(input.value) || 0));
    slider.value = value;
    input.value = value;
    updateRangeSliderTrack(which === 'min');
    applyFilters();
}

// Update range slider track visual
function updateRangeSliderTrack(changedMin) {
    const minSlider = document.getElementById('lengthMin');
    const maxSlider = document.getElementById('lengthMax');

    let lengthMin = parseFloat(minSlider.value);
    let lengthMax = parseFloat(maxSlider.value);

    if (changedMin && lengthMin > lengthMax) {
        minSlider.value = lengthMax;
        lengthMin = lengthMax;
    }
    if (!changedMin && lengthMax < lengthMin) {
        maxSlider.value = lengthMin;
        lengthMax = lengthMin;
    }

    document.getElementById('lengthMinInput').value = lengthMin;
    document.getElementById('lengthMaxInput').value = lengthMax;
    const minPercent = (lengthMin / maxSlider.max) * 100;
    const maxPercent = (lengthMax / maxSlider.max) * 100;

    const track = document.querySelector('.range-slider-track');
    track.style.background = `linear-gradient(to left, #e0e0e0 0%, #e0e0e0 ${minPercent}%, #2196F3 ${minPercent}%, #2196F3 ${maxPercent}%, #e0e0e0 ${maxPercent}%, #e0e0e0 100%)`;
}

// Toggle sidebar minimize/expand
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const expandBtn = document.getElementById('expandBtn');
    const footer = document.getElementById('footer');
    const mapAnchor = map
        ? map.containerPointToLatLng([map.getSize().x / 2, 0])
        : null;

    const handleSidebarTransitionEnd = event => {
        const layoutProperties = ['height', 'max-height', 'width', 'margin-left'];
        if (
            event.target !== sidebar ||
            !map ||
            !layoutProperties.includes(event.propertyName)
        ) {
            return;
        }

        sidebar.removeEventListener('transitionend', handleSidebarTransitionEnd);
        map.invalidateSize({ pan: false, animate: false });
        if (mapAnchor) {
            const size = map.getSize();
            const anchorPoint = map.project(mapAnchor, map.getZoom());
            const targetCenter = map.unproject(
                [anchorPoint.x, anchorPoint.y + size.y / 2],
                map.getZoom()
            );
            map.setView(targetCenter, map.getZoom(), { animate: false });
        }
    };
    sidebar.addEventListener('transitionend', handleSidebarTransitionEnd);

    sidebar.classList.toggle('minimized');
    const isMinimized = sidebar.classList.contains('minimized');
    footer.classList.toggle('is-collapsed', isMinimized);

    if (isMinimized) {
        setTimeout(() => {
            expandBtn.style.display = sidebar.classList.contains('minimized') ? 'block' : 'none';
        }, 300);
    } else {
        expandBtn.style.display = 'none';
    }

    // Update URL with sidebar state
    const params = new URLSearchParams(window.location.search);
    if (isMinimized) {
        params.set('minimized', 'true');
    } else {
        params.delete('minimized');
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);

}

// Switch between Filters and Hikes tabs on mobile
function switchTab(tabName) {
    const filtersTab = document.getElementById('filtersTab');
    const hikesTab = document.getElementById('hikesTab');
    const tabBtns = document.querySelectorAll('.tab-btn');

    if (tabName === 'filters') {
        filtersTab.classList.add('active');
        hikesTab.classList.remove('active');
    } else {
        hikesTab.classList.add('active');
        filtersTab.classList.remove('active');
    }

    // Update active button
    tabBtns.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// Toggle section collapse/expand
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const header = section.previousElementSibling;

    section.classList.toggle('collapsed');
    header.classList.toggle('collapsed');
}

// Populate tag filter checkboxes
function populateTagFilters() {
    const tagCounts = new Map();
    allHikes.forEach(hike => {
        if (hike.tags && Array.isArray(hike.tags)) {
            new Set(hike.tags).forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        }
    });

    const tags = Array.from(tagCounts.entries())
        .filter(([, count]) => count >= 10)
        .map(([tag]) => tag)
        .sort((a, b) => a.localeCompare(b, 'he'));

    const tagFilter = document.getElementById('tagFilter');
    const categories = {
        'סוג המסלול': [],
        'למי מתאים': [],
        'מה בדרך': [],
        'נגישות ותנאים': []
    };

    tags.forEach(tag => categories[getTagCategory(tag)].push(tag));
    tagFilter.innerHTML = Object.entries(categories)
        .filter(([, categoryTags]) => categoryTags.length > 0)
        .map(([category, categoryTags]) => `
            <div class="tag-group">
                <h4>${category}</h4>
                <div class="tag-group-options">
                    ${categoryTags.map(tag => `
                        <label class="tag-checkbox" data-tag="${tag}">
                            <input type="checkbox" value="${tag}" onchange="applyFilters()">
                            <span>${tag}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `).join('');
}

function getTagCategory(tag) {
    if (['מעגלי', 'טיול עירוני', 'טיול שטח', 'מקטע משביל ישראל'].includes(tag)) return 'סוג המסלול';
    if (['מתאים למשפחות', 'מתאים לכלבים', 'מתאים לאופניים', 'למיטיבי לכת', 'רומנטי'].includes(tag)) return 'למי מתאים';
    if (['מים ומעיינות', 'נוף ותצפית', 'פריחה', 'טבע', 'היסטוריה ואומנות', 'פיקניק'].includes(tag)) return 'מה בדרך';
    return 'נגישות ותנאים';
}

// Apply filters
function applyFilters() {
    const lengthMin = parseFloat(document.getElementById('lengthMin').value);
    const lengthMax = parseFloat(document.getElementById('lengthMax').value);

    syncLengthInput('min');
    syncLengthInput('max');

    // Update length display
    document.getElementById('lengthDisplay').textContent = `${lengthMin.toFixed(1)} - ${lengthMax.toFixed(1)}`;

    // Get selected tags
    const selectedTags = Array.from(document.querySelectorAll('#tagFilter input:checked'))
        .map(input => input.value);

    // Get tag logic (AND or OR)
    const tagLogic = document.querySelector('input[name="tagLogic"]:checked').value;

    // Filter hikes
    filteredHikes = allHikes.filter(hike => {
        const lengthInRange = hike.length >= lengthMin && hike.length <= lengthMax;

        let tagsMatch = true;
        if (selectedTags.length > 0) {
            if (tagLogic === 'AND') {
                // All selected tags must be present
                tagsMatch = hike.tags && selectedTags.every(tag => hike.tags.includes(tag));
            } else {
                // At least one selected tag must be present
                tagsMatch = hike.tags && selectedTags.some(tag => hike.tags.includes(tag));
            }
        }

        return lengthInRange && tagsMatch;
    });

    // Update URL params with filter state
    updateUrlFilters(lengthMin, lengthMax, selectedTags, tagLogic);

    mapAlreadyUpdated = false;
    displayHikes();
    updateMap();
    updateFilterSummary(lengthMin, lengthMax, selectedTags);
    updateMapStatus();
}

function updateFilterSummary(lengthMin, lengthMax, selectedTags) {
    const activeFilters = (lengthMin > 0 ? 1 : 0) + (lengthMax < maxLength ? 1 : 0) + selectedTags.length;
    document.getElementById('activeFilterCount').textContent = `${activeFilters} פעילים`;
    const summary = document.getElementById('filterSummary');
    const rangeDetail = lengthMin > 0 || lengthMax < maxLength
        ? `${lengthMin.toFixed(1)}–${lengthMax.toFixed(1)} ק"מ`
        : '';
    summary.innerHTML = activeFilters === 0
        ? '<span>כל הטיולים מוצגים</span>'
        : `<span><strong>${filteredHikes.length}</strong> טיולים מתאימים</span><span class="summary-detail">${[rangeDetail, selectedTags.length ? `${selectedTags.length} תגיות` : ''].filter(Boolean).join(' · ')}</span>`;
}

// Reset filters
function resetFilters() {
    document.getElementById('lengthMin').value = 0;
    document.getElementById('lengthMax').value = maxLength;
    document.querySelectorAll('#tagFilter input').forEach(input => input.checked = false);
    document.querySelector('input[name="tagLogic"][value="AND"]').checked = true;

    filteredHikes = [...allHikes];

    // Update URL params to reflect reset
    updateUrlFilters(0, maxLength, [], 'AND');

    displayHikes();
    updateMap();

    updateRangeSliderTrack(false);
    document.getElementById('lengthDisplay').textContent = `0.0 - ${maxLength.toFixed(1)}`;
    updateFilterSummary(0, maxLength, []);
    updateMapStatus();
}

// Sort hikes based on selected sort option
function hasValidCoords(hike) {
    if (!Array.isArray(hike.coords) || hike.coords.length < 2) {
        return false;
    }

    const latitude = Number(hike.coords[0]);
    const longitude = Number(hike.coords[1]);
    return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
        && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function sortHikes(hikes) {
    const sortBy = document.getElementById('sortBy')?.value || 'name';
    const sorted = [...hikes];

    if (sortBy === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    } else if (sortBy === 'length') {
        sorted.sort((a, b) => a.length - b.length);
    } else if (sortBy === 'difficulty') {
        const difficultyOrder = {'קל': 1, 'בינוני': 2, 'קשה': 3, 'לא ידוע': 4};
        sorted.sort((a, b) => (difficultyOrder[a.difficulty] || 999) - (difficultyOrder[b.difficulty] || 999));
    } else if (sortBy === 'north-south') {
        sorted.sort((a, b) => {
            const latA = hasValidCoords(a) ? Number(a.coords[0]) : null;
            const latB = hasValidCoords(b) ? Number(b.coords[0]) : null;

            if (latA === null && latB === null) return 0;
            if (latA === null) return 1;
            if (latB === null) return -1;
            return latB - latA;
        });
    }

    return sorted;
}

// Display hikes in list
function displayHikes() {
    const hikesList = document.getElementById('hikesList');
    const previousScrollTop = hikesList.scrollTop;
    document.getElementById('hikeCount').textContent = filteredHikes.length;

    if (filteredHikes.length === 0) {
        hikesList.innerHTML = '<li style="padding: 20px; text-align: center; color: #999;">No hikes match your filters</li>';
        return;
    }

    const sortedHikes = sortHikes(filteredHikes);
    hikesList.innerHTML = sortedHikes.map(hike => `
        <li onclick="selectHike('${hike.name.replace(/'/g, "\\'")}')" data-hike-name="${hike.name}">
            <div class="hike-item-title">${hike.name}</div>
            <div class="hike-item-info">
                📏 ${hike.length} km
                ${hike.tags ? '• ' + hike.tags.slice(0, 2).join(', ') + (hike.tags.length > 2 ? '...' : '') : ''}
            </div>
        </li>
    `).join('');
    hikesList.scrollTop = previousScrollTop;
}

// Get marker color based on tags
function getMarkerColor(difficulty) {
    if (!difficulty) {
        return {fill: '#2196F3', border: '#1976D2'}; // Default blue
    }

    // Check for specific tags (priority order)
    if (difficulty === 'קשה') return {fill: '#F44336', border: '#D32F2F'}; // Red
    if (difficulty === 'בינוני') return {fill: '#FF9800', border: '#F57C00'}; // Orange
    if (difficulty === 'קל') return {fill: '#4CAF50', border: '#388E3C'}; // Green

    // Default if no matching tags
    return {fill: '#2196F3', border: '#1976D2'};
}

// Update URL with filter state
function updateUrlFilters(lengthMin, lengthMax, selectedTags, tagLogic) {
    const params = new URLSearchParams(window.location.search);

    if (lengthMin !== 0) {
        params.set('lengthMin', lengthMin.toFixed(1));
    } else {
        params.delete('lengthMin');
    }

    if (lengthMax !== maxLength) {
        params.set('lengthMax', lengthMax.toFixed(1));
    } else {
        params.delete('lengthMax');
    }

    if (tagLogic !== 'AND') {
        params.set('tagLogic', tagLogic);
    } else {
        params.delete('tagLogic');
    }

    if (selectedTags.length > 0) {
        params.set('tags', selectedTags.join(','));
    } else {
        params.delete('tags');
    }

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
}

// Store hike to open after markers are ready
let hikeToOpenPopup = null;
let mapAlreadyUpdated = false;

// Restore filters from URL params
function restoreFiltersFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);

    const lengthMin = parseFloat(urlParams.get('lengthMin'));
    const lengthMax = parseFloat(urlParams.get('lengthMax'));
    const tagsStr = urlParams.get('tags');
    const tagLogic = urlParams.get('tagLogic') || 'AND';
    const minimized = urlParams.get('minimized') === 'true';
    const hikeParam = urlParams.get('hike');

    if (!isNaN(lengthMin)) {
        document.getElementById('lengthMin').value = lengthMin;
    }
    if (!isNaN(lengthMax)) {
        document.getElementById('lengthMax').value = lengthMax;
    }

    document.querySelector(`input[name="tagLogic"][value="${tagLogic}"]`).checked = true;

    if (tagsStr) {
        const tags = tagsStr.split(',');
        tags.forEach(tag => {
            const checkbox = document.querySelector(`#tagFilter input[value="${tag}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }

    if (minimized) {
        toggleSidebar();
    }

    // Store hike to open popup after markers are created
    if (hikeParam) {
        hikeToOpenPopup = hikeParam;
    }

    applyFilters();
}

// Update map markers
function updateMap() {
    if (markerClusterGroup) {
        map.removeLayer(markerClusterGroup);
    }
    markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        disableClusteringAtZoom: 12,
        maxClusterRadius: 55,
        chunkedLoading: true
    });
    markers = [];

    // Add new markers
    filteredHikes.forEach(hike => {
        if (hasValidCoords(hike)) {
            const colors = getMarkerColor(hike.difficulty);
            const marker = L.marker([Number(hike.coords[0]), Number(hike.coords[1])], {
                icon: createDifficultyIcon(colors, false),
                title: hike.name
            });

            marker.bindPopup(`
                <strong>${hike.name}</strong><br>
                <strong>קושי:</strong> ${hike.difficulty}<br>
                <strong>אורך:</strong> ${hike.length} ק"מ<br>
                <strong>מקור:</strong> <a href="${hike.source}" target="_blank">${hike.source ? hike.source.split('//')[1].split('/')[0] : 'N/A'}</a><br>
                ${hike.tags ? '<strong>תגיות:</strong> ' + hike.tags.join(', ') : ''}
            `);

            marker.hikeData = hike;
            marker.on('click', function () {
                selectHike(hike.name, false, marker);
            });

            // Update URL when popup opens
            marker.on('popupopen', function () {
                const params = new URLSearchParams(window.location.search);
                params.set('hike', hike.name);
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState({}, '', newUrl);
            });

            // Update URL when popup closes
            marker.on('popupclose', function () {
                const params = new URLSearchParams(window.location.search);
                params.delete('hike');
                const newUrl = `${window.location.pathname}?${params.toString()}`;
                window.history.replaceState({}, '', newUrl);
            });

            markers.push(marker);
            markerClusterGroup.addLayer(marker);
        }

    });
    map.addLayer(markerClusterGroup);

    // Open popup for hike if one was specified in URL
    if (hikeToOpenPopup) {
        const marker = markers.find(m => m.hikeData.name === hikeToOpenPopup);
        if (marker) {
            marker.openPopup();
            hikeToOpenPopup = null;
        }
    }

    mapAlreadyUpdated = true;

    updateMapStatus();
}

// Select hike from list
function selectHike(hikeName, moveMap = true, selectedMarker = null) {
    const hike = selectedMarker?.hikeData || filteredHikes.find(h => h.name === hikeName);
    if (hike) {
        markers.forEach(marker => {
            const markerColors = getMarkerColor(marker.hikeData.difficulty);
            marker.setIcon(createDifficultyIcon(markerColors, false));
        });

        // Highlight in list
        document.querySelectorAll('.hikes-list li').forEach(li => li.classList.remove('active'));
        Array.from(document.querySelectorAll('li[data-hike-name]'))
            .find(li => li.dataset.hikeName === hikeName)
            ?.classList.add('active');

        // Center map on hike with smooth animation
        if (moveMap && hasValidCoords(hike)) {
            map.flyTo([Number(hike.coords[0]), Number(hike.coords[1])], 12, {
                duration: 1
            });
        }

        // Find and open the marker popup
        const marker = selectedMarker || markers.find(m => m.hikeData.name === hikeName);
        if (marker) {
            const markerColors = getMarkerColor(marker.hikeData.difficulty);
            marker.setIcon(createDifficultyIcon(markerColors, true));
            marker.openPopup();
        }
    }
}

function createDifficultyIcon(colors, selected) {
    const width = selected ? 30 : 24;
    const height = selected ? 38 : 31;
    return L.divIcon({
        className: 'difficulty-marker-wrapper',
        html: `
            <svg class="difficulty-pin${selected ? ' is-selected' : ''}" width="${width}" height="${height}" viewBox="0 0 24 31" aria-hidden="true">
                <path class="difficulty-pin-shadow" d="M12 30.1S2.2 20.5 2.2 12A9.8 9.8 0 1 1 21.8 12C21.8 20.5 12 30.1 12 30.1Z"/>
                <path class="difficulty-pin-body" d="M12 29.1S3.2 20 3.2 12A8.8 8.8 0 1 1 20.8 12C20.8 20 12 29.1 12 29.1Z" fill="${colors.fill}" stroke="${colors.border}"/>
                <circle class="difficulty-pin-center" cx="12" cy="12" r="3.1"/>
            </svg>
        `,
        iconSize: [width, height],
        iconAnchor: [width / 2, height],
        popupAnchor: [0, -height + 4]
    });
}

function updateMapStatus() {
    const status = document.getElementById('mapStatus');
    if (filteredHikes.length === 0) {
        status.textContent = 'לא נמצאו מסלולים לפי המסננים';
        status.classList.add('is-empty');
        return;
    }

    status.textContent = `${filteredHikes.length} מסלולים מתאימים למסננים`;
    status.classList.remove('is-empty');
}
