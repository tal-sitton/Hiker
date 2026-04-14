// Initialize map
let map;
let markers = [];
let allHikes = [];
let filteredHikes = [];
let maxLength = 100;

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    initMap();
    loadHikes();
    setupEventListeners();
});

// Initialize Leaflet map
function initMap() {
    map = L.map('map').setView([31.25, 35.2], 7); // Center on Israel

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© תרומות OpenStreetMap'
    }).addTo(map);
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

        displayHikes();
        populateTagFilters();

        // Ensure map is ready before updating markers
        setTimeout(() => {
            updateMap();
        }, 100);
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
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.querySelector('.popup-close').addEventListener('click', closePopup);
    document.getElementById('minimizeBtn').addEventListener('click', toggleSidebar);
    document.getElementById('expandBtn').addEventListener('click', toggleSidebar);

    // Close popup when clicking outside
    document.querySelector('.popup').addEventListener('click', function (e) {
        if (e.target === this) {
            closePopup();
        }
    });
}

// Toggle sidebar minimize/expand
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const expandBtn = document.getElementById('expandBtn');

    sidebar.classList.toggle('minimized');
    if (sidebar.classList.contains('minimized')) {
        setTimeout(() => {
        expandBtn.style.display = sidebar.classList.contains('minimized') ? 'block' : 'none';
    }, 300);
    }
    else {
        expandBtn.style.display = 'none';
    }

    // Resize map after transition completes
    setTimeout(() => {
        map.invalidateSize();
    }, 300);
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
    const allTags = new Set();
    allHikes.forEach(hike => {
        if (hike.tags && Array.isArray(hike.tags)) {
            hike.tags.forEach(tag => allTags.add(tag));
        }
    });

    const tagFilter = document.getElementById('tagFilter');
    tagFilter.innerHTML = '';

    Array.from(allTags).sort().forEach(tag => {
        const label = document.createElement('label');
        label.className = 'tag-checkbox';
        label.innerHTML = `
            <input type="checkbox" value="${tag}" onchange="applyFilters()">
            <span>${tag}</span>
        `;
        tagFilter.appendChild(label);
    });
}

// Apply filters
function applyFilters() {
    const lengthMin = parseFloat(document.getElementById('lengthMin').value);
    const lengthMax = parseFloat(document.getElementById('lengthMax').value);

    // Update length display
    document.getElementById('lengthDisplay').textContent = `${lengthMin.toFixed(1)} - ${lengthMax.toFixed(1)}`;

    // Get selected tags
    const selectedTags = Array.from(document.querySelectorAll('#tagFilter input:checked'))
        .map(input => input.value);

    // Filter hikes
    filteredHikes = allHikes.filter(hike => {
        const lengthInRange = hike.length >= lengthMin && hike.length <= lengthMax;

        let tagsMatch = true;
        if (selectedTags.length > 0) {
            tagsMatch = hike.tags && selectedTags.some(tag => hike.tags.includes(tag));
        }

        return lengthInRange && tagsMatch;
    });

    displayHikes();
    updateMap();
}

// Reset filters
function resetFilters() {
    document.getElementById('lengthMin').value = 0;
    document.getElementById('lengthMax').value = maxLength;
    document.querySelectorAll('#tagFilter input').forEach(input => input.checked = false);

    filteredHikes = [...allHikes];
    displayHikes();
    updateMap();

    // Update length display
    document.getElementById('lengthDisplay').textContent = `0 - ${maxLength}`;
}

// Sort hikes based on selected sort option
function sortHikes(hikes) {
    const sortBy = document.getElementById('sortBy')?.value || 'name';
    const sorted = [...hikes];

    if (sortBy === 'name') {
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
    } else if (sortBy === 'length') {
        sorted.sort((a, b) => a.length - b.length);
    } else if (sortBy === 'difficulty') {
        const difficultyOrder = { 'קל': 1, 'בינוני': 2, 'קשה': 3, 'לא ידוע': 4 };
        sorted.sort((a, b) => (difficultyOrder[a.difficulty] || 999) - (difficultyOrder[b.difficulty] || 999));
    } else if (sortBy === 'north-south') {
        sorted.sort((a, b) => {
            const latA = a.coords ? a.coords[0] : -90;
            const latB = b.coords ? b.coords[0] : -90;
            return latB - latA;
        });
    }

    return sorted;
}

// Display hikes in list
function displayHikes() {
    const hikesList = document.getElementById('hikesList');
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

// Update map markers
function updateMap() {
    // Remove existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add new markers
    filteredHikes.forEach(hike => {
        if (hike.coords && hike.coords.length === 2) {
            const colors = getMarkerColor(hike.difficulty);
            const marker = L.circleMarker([hike.coords[0], hike.coords[1]], {
                radius: 8,
                fillColor: colors.fill,
                color: colors.border,
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(map);

            marker.bindPopup(`
                <strong>${hike.name}</strong><br>
                <strong>קושי:</strong> ${hike.difficulty}<br>
                <strong>אורך:</strong> ${hike.length} ק"מ<br>
                <strong>מקור:</strong> <a href="${hike.source}" target="_blank">${hike.source ? hike.source.split('//')[1].split('/')[0] : 'N/A'}</a><br>
                ${hike.tags ? '<strong>תגיות:</strong> ' + hike.tags.join(', ') : ''}
            `);

            marker.hikeData = hike;
            markers.push(marker);
        }
    });

    // Fit map to show all markers
    if (markers.length > 0) {
        L.featureGroup(markers);
    } else {
        console.log('No markers to display, keeping default view');
    }
}

// Select hike from list
function selectHike(hikeName) {
    const hike = filteredHikes.find(h => h.name === hikeName);
    if (hike) {
        showHikePopup(hike);

        // Highlight in list
        document.querySelectorAll('.hikes-list li').forEach(li => li.classList.remove('active'));
        document.querySelector(`li[data-hike-name="${hikeName}"]`)?.classList.add('active');

        // Center map on hike
        if (hike.coords) {
            map.setView([hike.coords[0], hike.coords[1]], 12);
        }
    }
}

// Show hike popup
function showHikePopup(hike) {
    document.getElementById('popupTitle').textContent = hike.name;
    document.getElementById('popupLength').textContent = hike.length;
    document.getElementById('popupDifficulty').textContent = hike.difficulty;
    document.getElementById('popupTags').textContent = hike.tags ? hike.tags.join(', ') : 'None';
    document.getElementById('popupSource').textContent = hike.source ? hike.source.split('//')[1].split('/')[0] : 'N/A';
    document.getElementById('popupSource').href = hike.source ? hike.source : 'N/A';

    document.querySelector('.popup').classList.add('show');
}

// Close popup
function closePopup() {
    document.querySelector('.popup').classList.remove('show');
}
