var isCapturing = false;
var responses = [];
var requestIds = {};
var sortField = 'size';
var sortDirection = 'desc';
var contentTypeFilter = 'all';

const attachedTargets = new Set();

updateExtensionIcon(isCapturing);
updateExtensionBadge(0);

// Attach debugger when capture is enabled
async function attachDebugger(tabId) {
  if (attachedTargets.has(tabId)) return;

  try {

    chrome.tabs.get(tabId, async (tab) => {
      console.log('Debugger attached to:', tab.title);
      if (tab.url && tab.url.startsWith('http')) {
        await chrome.debugger.attach({ tabId: tabId }, '1.2');
        await chrome.debugger.sendCommand({ tabId: tabId }, 'Network.enable');

        attachedTargets.add(tabId);
      };
    });

  } catch (error) {
    console.error('Failed to attach debugger:', error);
  }
}

async function detachDebugger(tabId) {
  if (!tabId) return;

  try {
    await chrome.debugger.detach({ tabId });
    console.log('Debugger detached from tab:', tabId);
  } catch (err) {
    console.error('Failed to detach debugger:', err);
  }
}

// Detach debugger from all attached tabs
async function detachAllDebuggers() {
  try {

    for (const tabId of attachedTargets) {
      await detachDebugger(tabId);
    }

    attachedTargets.clear();
  } catch (error) {
    console.error('Failed to detach all debuggers. Error:', error);
  }
}

// Handle new tabs
chrome.tabs.onCreated.addListener(async (tab) => {
  if (isCapturing && tab.url && tab.url.startsWith('http')) {
    await attachDebugger(tab.id);
  }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (isCapturing && changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    await attachDebugger(tabId);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (isCapturing) {
    await attachDebugger(activeInfo.tabId);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  detachDebugger(tabId);
});

chrome.debugger.onEvent.addListener(function (source, method, params) {

  if (!isCapturing) return;

  if (method == "Network.responseReceived") {
    requestIds[params.requestId] = params.response
    return;
  }

  if (method != "Network.loadingFinished") return;

  var requestId = params.requestId;
  if (requestIds[requestId] === undefined) return;

  chrome.debugger.sendCommand(source, "Network.getResponseBody", { "requestId": requestId },
    function (response) {
      if (chrome.runtime.lastError) {
        console.log('Handled error: ', response, chrome.runtime.lastError.message);
        return;
      }

      if (response) {
        const responseObject = requestIds[requestId];
        const url = responseObject.url;
        const { body, base64Encoded } = response;

        console.log("Got response for " + url);

        let content;
        if (base64Encoded) {
          const binaryString = atob(body);
          content = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            content[i] = binaryString.charCodeAt(i);
          }
        } else {
          const encoder = new TextEncoder();
          content = encoder.encode(body);
        }

        const newResponse = {
          id: requestId,
          url: url,
          contentType: getResponseHeaderValue(responseObject, 'content-type'),
          size: content.length,
          timestamp: Date.now(),
          content: content
        };
        responses.push(newResponse);

        notifyPopupOfNewResponse(newResponse);
        updateExtensionBadge(responses.length);
      } else {
        console.log("Empty response for " + url);
      }

    });
});

// Function to notify popup of new responses
function notifyPopupOfNewResponse(response) {
  chrome.runtime.sendMessage({
    action: 'responseAdded',
    response: { ...response, content: undefined }
  });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.action);
  (async () => {
    try {
      switch (request.action) {
        case 'toggleCapturing': {
          isCapturing = !isCapturing;

          if (!isCapturing) {
            detachAllDebuggers();
          }

          await updateExtensionIcon(isCapturing);
          sendResponse({ isCapturing: isCapturing, success: true });
          break;
        }

        case 'getCapturedResponses': {
          const responsesWithoutContent = responses.map(response => ({
            ...response,
            content: undefined
          }));

          sendResponse({
            responses: responsesWithoutContent,
            isCapturing,
            sortField,
            sortDirection,
            contentTypeFilter,
            success: true
          });

          break;
        }

        case 'updateSortPreferences': {
          sortField = request.sortField;
          sortDirection = request.sortDirection;
          sendResponse({ success: true });
          break;
        }

        case 'updateContentTypeFilter': {
          contentTypeFilter = request.contentTypeFilter;
          sendResponse({ success: true });
          break;
        }

        case 'clearResponses': {
          clearGlobals();
          updateExtensionBadge(0);
          contentTypeFilter = 'all';  // Reset content type filter to 'all'
          sendResponse({ success: true });
          break;
        }

        case 'downloadResponse': {
          const response = responses.find(response => response.id === request.requestId);
          if (response.content) {
            sendResponse({
              content: Array.from(response.content),
              success: true
            });
          } else {
            sendResponse({ success: false, error: 'Response not found' });
          }
          break;
        }

        default:
          sendResponse({ error: 'Unknown action', success: false });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ error: error.message, success: false });
    }
  })();
  return true;
});

// Function to update extension icon based on capture state
async function updateExtensionIcon(isCapturing) {
  try {
    const canvas = new OffscreenCanvas(128, 128);
    const ctx = canvas.getContext('2d');

    // Draw square background
    ctx.fillStyle = isCapturing ? '#2196F3' : '#4CAF50';  // Blue when capturing, Green when inactive
    ctx.fillRect(0, 0, 128, 128);

    // Draw a smaller dot in the center
    ctx.beginPath();
    ctx.arc(64, 64, 20, 0, 2 * Math.PI);
    ctx.fillStyle = isCapturing ? '#FF0000' : '#FFFFFF';  // Red dot when capturing, white when inactive
    ctx.fill();

    const imageData = ctx.getImageData(0, 0, 128, 128);

    await chrome.action.setIcon({ imageData });
  } catch (error) {
    console.error('Error updating icon:', error);
  }
}

// Function to update extension badge
function updateExtensionBadge(count) {
  chrome.action.setBadgeText({ text: count > 0 ? count.toString() : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2196F3' });
}

function getResponseHeaderValue(response, headerName) {

  for (const header in response.headers) {
    if (header.toLowerCase() === headerName.toLowerCase()) {
      return response.headers[header];
    }
  }
  return null;
}

function clearGlobals() {
  responses = [];
  requestIds = {};
}
