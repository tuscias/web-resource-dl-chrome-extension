var allResponses = [];
var isCapturing = false;

// Initialize capture state and UI
document.addEventListener('DOMContentLoaded', async function () {
  console.log('Popup loaded');

  const toggleButton = document.getElementById('toggleCapture');
  const clearButton = document.getElementById('clearResponses');
  const filterSelect = document.getElementById('filterType');
  const responseList = document.getElementById('responseList');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('searchFilter');
  const sortMenu = document.getElementById('sortMenu');
  const sortDropdown = document.getElementById('sortDropdown');
  const sortDirectionBtn = document.getElementById('sortDirection');
  const sortDirectionIcon = sortDirectionBtn.querySelector('.sort-direction-icon');

  let sortDirection = 'desc';
  let sortField = 'size';

  // Initialize capture state
  chrome.runtime.sendMessage({ action: 'getCapturedResponses' }, function (response) {
    console.log('Initial state response:', response);
    if (response.success) {
      allResponses = response.responses || [];
      isCapturing = response.isCapturing;
      sortField = response.sortField;
      sortDirection = response.sortDirection;
      
      updateCaptureState(isCapturing);
      
      // Update sort UI
      sortDropdown.querySelectorAll('.sort-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.sort === sortField);
      });
      updateSortDirectionUI();
      
      // Update content type filter
      updateContentTypeFilter(allResponses);
      filterSelect.value = response.contentTypeFilter;
      
      updateUI();
    } else {
      console.error('Failed to get initial state:', response.error);
    }
  });

  // Toggle capturing
  toggleButton.addEventListener('click', async function () {
    console.log('Toggle button clicked, current state:', isCapturing);

    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'toggleCapturing' }, resolve);
      });

      console.log('Toggle response:', response);

      if (response.success) {
        isCapturing = response.isCapturing;
        updateCaptureState(isCapturing);
        console.log('Capture state updated:', isCapturing);
      } else {
        console.error('Failed to toggle capturing:', response.error);
      }
    } catch (error) {
      console.error('Error toggling capture:', error);
    }
  });

  // Update capture button state
  function updateCaptureState(capturing) {
    console.log('Updating capture state UI:', capturing);
    const buttonText = capturing ? 'Stop Capturing' : 'Start Capturing';
    toggleButton.querySelector('.btn-text').textContent = buttonText;
    toggleButton.classList.toggle('is-capturing', capturing);
  }

  // Format timestamp to time
  function formatTimestamp(timestamp) {
    return new Date(timestamp).toTimeString().slice(0, 8);
  }

  // Create response item element
  function createResponseItem(response) {
    const div = document.createElement('div');
    div.className = 'response-item';

    div.innerHTML = `
      <div class="response-details">
        <div class="response-url" title="${response.url}">${response.url}</div>
        <div class="response-meta">
          <span>${formatTimestamp(response.timestamp)}</span>
          <span>${response.contentType}</span>
          <span class="response-size">${formatSize(response.size)}</span>
        </div>
      </div>
      <div class="response-actions">
        <button class="download-button" title="Download">
          <span class="material-icons">download</span>
        </button>
      </div>
    `;

    const downloadButton = div.querySelector('.download-button');
    downloadButton.addEventListener('click', () => downloadResponse(response));

    return div;
  }

  // Update response list
  function updateResponseList(responses) {
    console.log('Updating response list:', responses.length);

    // Show/hide empty state
    emptyState.style.display = responses.length === 0 ? 'flex' : 'none';
    responseList.style.display = responses.length === 0 ? 'none' : 'block';

    // Update response list
    responseList.innerHTML = '';
    responses.forEach(response => {
      responseList.appendChild(createResponseItem(response));
    });
  }

  // Filter responses
  function filterResponses(responses) {
    const typeFilter = filterSelect.value;
    const searchQuery = searchInput.value.toLowerCase().trim();

    return responses
      .filter(response => {
        const matchesType = typeFilter === 'all' || response.contentType === typeFilter;
        const matchesSearch = !searchQuery || response.url.toLowerCase().includes(searchQuery);
        return matchesType && matchesSearch;
      })
      .sort((a, b) => {
        let comparison;
        switch (sortField) {
          case 'timestamp':
            comparison = a.timestamp - b.timestamp;
            break;
          case 'url':
            comparison = a.url.localeCompare(b.url);
            break;
          case 'size':
          default:
            comparison = a.size - b.size;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }

  // Update content type filter
  function updateContentTypeFilter(responses) {
    const types = new Set();
    responses.forEach(response => {
      if (response.contentType) {
        types.add(response.contentType);
      }
    });

    const currentValue = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Content Types</option>';

    Array.from(types).sort().forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      filterSelect.appendChild(option);
    });

    filterSelect.value = currentValue;
  }

  // Update UI
  function updateUI() {
    const filteredResponses = filterResponses(allResponses);
    updateResponseList(filteredResponses);
    updateContentTypeFilter(allResponses);
    updateStats(filteredResponses.length, allResponses.length);
  }

  // Update sort direction UI
  function updateSortDirectionUI() {
    sortDirectionIcon.classList.toggle('asc', sortDirection === 'asc');
    sortDirectionBtn.title = `Sort ${sortDirection === 'asc' ? 'Descending' : 'Ascending'}`;
  }

  // Event listeners
  filterSelect.addEventListener('change', () => {
    // Update background script
    chrome.runtime.sendMessage({ 
      action: 'updateContentTypeFilter',
      contentTypeFilter: filterSelect.value
    });
    updateUI();
  });
  searchInput.addEventListener('input', updateUI);

  // Sort menu handling
  sortMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    sortDropdown.classList.toggle('show');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    sortDropdown.classList.remove('show');
  });

  // Handle sort option selection
  sortDropdown.addEventListener('click', (e) => {
    const option = e.target.closest('.sort-option');
    if (!option) return;

    sortField = option.dataset.sort;

    // Update active state
    sortDropdown.querySelectorAll('.sort-option').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.sort === sortField);
    });

    // Update background script
    chrome.runtime.sendMessage({ 
      action: 'updateSortPreferences',
      sortField,
      sortDirection
    });

    updateUI();
  });

  // Handle sort direction toggle
  sortDirectionBtn.addEventListener('click', () => {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    updateSortDirectionUI();

    // Update background script
    chrome.runtime.sendMessage({ 
      action: 'updateSortPreferences',
      sortField,
      sortDirection
    });

    updateUI();
  });

  clearButton.addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'clearResponses' }, function (response) {
      if (response.success) {
        allResponses = [];
        filterSelect.value = 'all';
        updateUI();
      } else {
        console.error('Failed to clear responses:', response.error);
      }
    });
  });

  // Listen for new responses
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message);
    if (message.action === 'responseAdded') {
      allResponses.push(message.response);
      updateUI();
    }
  });
});

// Format file size
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Update stats
function updateStats(filteredCount, totalCount) {
  document.getElementById('visibleCount').textContent = filteredCount;
  document.getElementById('totalCount').textContent = totalCount;

  // Calculate total size of all responses
  const totalSize = allResponses.reduce((total, response) => total + response.size, 0);
  document.getElementById('totalSize').textContent = formatSize(totalSize);
}

// Download response
async function downloadResponse(response) {
  try {
    const contentResponse = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'downloadResponse', requestId: response.id }, resolve);
    });

    if (!contentResponse.success || !contentResponse.content) {
      console.error('Failed to get response content');
      return;
    }

    // Convert the array back to Uint8Array
    const content = new Uint8Array(contentResponse.content);

    // Create blob and download
    const blob = new Blob([content], { type: response.contentType });
    const url = URL.createObjectURL(blob);

    // Generate filename from URL or use a default
    const urlObj = new URL(response.url);
    const filename = urlObj.pathname.split('/').pop().split('?')[0] || 'download';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading response:', error);
  }
}
