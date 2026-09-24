let currentVideoUrl = null;

document.addEventListener('DOMContentLoaded', async () => {
  const statusDiv = document.getElementById('status');
  const downloadBtn = document.getElementById('downloadBtn');
  const thumbnailImg = document.getElementById('thumbnail');
  const loadingSpinner = document.getElementById('loadingThumb');
  const noThumbDiv = document.getElementById('noThumb');
  const videoUrlDisplay = document.getElementById('videoUrlDisplay');

  statusDiv.textContent = '🔍 Extracting video and preview...';
  if (loadingSpinner) loadingSpinner.style.display = 'inline-block';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractVideoAndFrame
    });

    const data = results[0]?.result;

    if (!data || !data.videoUrl) {
      statusDiv.textContent = '❌ No video found. Make sure video is playing.';
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      if (noThumbDiv) noThumbDiv.style.display = 'block';
      if (thumbnailImg) thumbnailImg.style.display = 'none';
      downloadBtn.disabled = true;
      return;
    }

    currentVideoUrl = data.videoUrl;
    if (videoUrlDisplay) {
      videoUrlDisplay.textContent = `Source: ${currentVideoUrl.substring(0, 80)}${currentVideoUrl.length > 80 ? '…' : ''}`;
    }

    if (data.thumbnailDataUrl) {
      thumbnailImg.src = data.thumbnailDataUrl;
      thumbnailImg.style.display = 'block';
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      if (noThumbDiv) noThumbDiv.style.display = 'none';
      statusDiv.textContent = '✅ Preview ready. Click download.';
      downloadBtn.disabled = false;
    } else {
      if (loadingSpinner) loadingSpinner.style.display = 'none';
      if (noThumbDiv) noThumbDiv.style.display = 'block';
      statusDiv.textContent = '⚠️ Preview not available, but video URL found.';
      downloadBtn.disabled = false;
    }

  } catch (err) {
    console.error(err);
    statusDiv.textContent = '⚠️ Error: ' + err.message;
    if (loadingSpinner) loadingSpinner.style.display = 'none';
    if (noThumbDiv) noThumbDiv.style.display = 'block';
    downloadBtn.disabled = true;
  }
});

// Download button action
document.getElementById('downloadBtn').addEventListener('click', () => {
  if (!currentVideoUrl) return;
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = '⬇️ Starting download...';
  chrome.downloads.download({
    url: currentVideoUrl,
    filename: `video_${Date.now()}.mp4`,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
    } else {
      statusDiv.textContent = '✅ Download started!';
    }
  });
});

// This function runs inside the web page
function extractVideoAndFrame() {
  const videos = document.querySelectorAll('video');
  let videoElem = null;
  let videoUrl = null;

  for (let v of videos) {
    let src = v.src || v.currentSrc;
    if (src && src.startsWith('http')) {
      videoUrl = src;
      videoElem = v;
      break;
    }
    const sources = v.querySelectorAll('source');
    for (let s of sources) {
      if (s.src && s.src.startsWith('http')) {
        videoUrl = s.src;
        videoElem = v;
        break;
      }
    }
    if (videoUrl) break;
  }

  if (!videoUrl || !videoElem) {
    return { videoUrl: null, thumbnailDataUrl: null };
  }

  let thumbnailDataUrl = null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = videoElem.videoWidth || 320;
    canvas.height = videoElem.videoHeight || 180;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
    thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  } catch (e) {
    console.warn('Thumbnail capture failed (CORS or tainted):', e);
  }

  return { videoUrl, thumbnailDataUrl };
}