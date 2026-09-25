let detectedVideo = null;

document.addEventListener("DOMContentLoaded", initializeExtension);

document
  .getElementById("downloadBtn")
  .addEventListener("click", downloadVideo);


async function initializeExtension() {
  const downloadButton = document.getElementById("downloadBtn");
  const statusElement = document.getElementById("status");
  const previewMessage = document.getElementById("previewMessage");
  const thumbnail = document.getElementById("thumbnail");
  const videoInfo = document.getElementById("videoInfo");
  const videoUrlElement = document.getElementById("videoUrl");

  try {
    statusElement.textContent = "Scanning the current page...";

    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!activeTab || !activeTab.id) {
      showError("Could not access the current browser tab.");
      return;
    }

    const results = await chrome.scripting.executeScript({
      target: {
        tabId: activeTab.id
      },
      func: findVideosOnPage
    });

    const result = results?.[0]?.result;

    if (!result || !result.videos || result.videos.length === 0) {
      previewMessage.textContent = "No supported video found.";

      statusElement.textContent =
        "No downloadable HTML5 video source was found on this page.";

      downloadButton.disabled = true;
      return;
    }

    detectedVideo = result.videos[0];

    videoInfo.style.display = "block";

    videoUrlElement.textContent =
      shortenUrl(detectedVideo.url);

    if (detectedVideo.thumbnail) {
      thumbnail.src = detectedVideo.thumbnail;

      thumbnail.onload = () => {
        thumbnail.style.display = "block";
        previewMessage.style.display = "none";
      };

      thumbnail.onerror = () => {
        thumbnail.style.display = "none";
        previewMessage.style.display = "block";
        previewMessage.textContent =
          "Video detected. Preview could not be loaded.";
      };
    } else {
      thumbnail.style.display = "none";
      previewMessage.style.display = "block";

      previewMessage.textContent =
        "Video detected. Preview is unavailable.";
    }

    if (result.videos.length > 1) {
      statusElement.textContent =
        `${result.videos.length} videos detected. ` +
        "The first supported video is selected.";
    } else {
      statusElement.textContent =
        "Video detected and ready to download.";
    }

    downloadButton.disabled = false;

  } catch (error) {
    console.error("Extension error:", error);

    showError(
      getReadableError(error)
    );
  }
}


async function downloadVideo() {
  if (!detectedVideo) {
    return;
  }

  const downloadButton =
    document.getElementById("downloadBtn");

  const statusElement =
    document.getElementById("status");

  downloadButton.disabled = true;

  statusElement.textContent =
    "Preparing download...";

  try {
    const filename =
      createFileName(detectedVideo);

    await chrome.downloads.download({
      url: detectedVideo.url,
      filename: filename,
      saveAs: true
    });

    statusElement.textContent =
      "Download started successfully.";

  } catch (error) {
    console.error(
      "Download failed:",
      error
    );

    statusElement.textContent =
      `Download failed: ${error.message}`;

  } finally {
    downloadButton.disabled = false;
  }
}


function createFileName(video) {
  const timestamp =
    new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

  const extension =
    detectFileExtension(
      video.url,
      video.type
    );

  return `video-${timestamp}.${extension}`;
}


function detectFileExtension(url, mimeType = "") {
  const mimeTypeMap = {
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/ogg": "ogv",
    "application/vnd.apple.mpegurl": "m3u8",
    "application/x-mpegURL": "m3u8"
  };

  if (
    mimeType &&
    mimeTypeMap[mimeType]
  ) {
    return mimeTypeMap[mimeType];
  }

  try {
    const pathname =
      new URL(url).pathname;

    const match =
      pathname.match(
        /\.([a-zA-Z0-9]{2,5})$/
      );

    if (match) {
      return match[1].toLowerCase();
    }

  } catch (error) {
    console.warn(
      "Could not determine file extension:",
      error
    );
  }

  return "mp4";
}


function shortenUrl(url) {
  const maximumLength = 120;

  if (url.length <= maximumLength) {
    return url;
  }

  return (
    url.substring(
      0,
      maximumLength
    ) + "..."
  );
}


function showError(message) {
  const downloadButton =
    document.getElementById("downloadBtn");

  const statusElement =
    document.getElementById("status");

  const previewMessage =
    document.getElementById("previewMessage");

  const thumbnail =
    document.getElementById("thumbnail");

  downloadButton.disabled = true;

  thumbnail.style.display = "none";

  previewMessage.style.display = "block";

  previewMessage.textContent =
    "Unable to detect video.";

  statusElement.textContent =
    message;
}


function getReadableError(error) {
  const message =
    error?.message || "";

  if (
    message.includes(
      "Cannot access contents of url"
    )
  ) {
    return (
      "Chrome does not allow extensions to access this page."
    );
  }

  if (
    message.includes(
      "The extensions gallery cannot be scripted"
    )
  ) {
    return (
      "Chrome Web Store pages cannot be scanned by extensions."
    );
  }

  return (
    message ||
    "An unexpected error occurred."
  );
}


/*
 * This entire function runs inside the active webpage.
 *
 * It:
 * 1. Finds HTML video elements.
 * 2. Extracts direct HTTP/HTTPS video URLs.
 * 3. Attempts to capture the first frame.
 * 4. Falls back to the video's poster image.
 */
async function findVideosOnPage() {
  const videoElements =
    Array.from(
      document.querySelectorAll("video")
    );

  const videos = [];

  const seenUrls =
    new Set();


  for (
    const videoElement
    of videoElements
  ) {
    const possibleSources = [];


    if (videoElement.currentSrc) {
      possibleSources.push({
        url: videoElement.currentSrc,
        type:
          videoElement.getAttribute("type") || ""
      });
    }


    if (videoElement.src) {
      possibleSources.push({
        url: videoElement.src,
        type:
          videoElement.getAttribute("type") || ""
      });
    }


    const sourceElements =
      videoElement.querySelectorAll("source");


    for (
      const sourceElement
      of sourceElements
    ) {
      if (sourceElement.src) {
        possibleSources.push({
          url: sourceElement.src,
          type:
            sourceElement.type || ""
        });
      }
    }


    const thumbnail =
      await getVideoThumbnail(
        videoElement
      );


    for (
      const source
      of possibleSources
    ) {
      const absoluteUrl =
        getAbsoluteUrl(source.url);


      if (
        !absoluteUrl ||
        seenUrls.has(absoluteUrl) ||
        !isSupportedUrl(absoluteUrl)
      ) {
        continue;
      }


      seenUrls.add(absoluteUrl);


      videos.push({
        url: absoluteUrl,
        type: source.type,
        thumbnail: thumbnail
      });
    }
  }


  return {
    videos: videos
  };


  function getAbsoluteUrl(url) {
    try {
      return new URL(
        url,
        window.location.href
      ).href;

    } catch {
      return null;
    }
  }


  function isSupportedUrl(url) {
    try {
      const parsedUrl =
        new URL(url);

      return (
        parsedUrl.protocol === "http:" ||
        parsedUrl.protocol === "https:"
      );

    } catch {
      return false;
    }
  }


  async function getVideoThumbnail(videoElement) {
    /*
     * First try to capture a frame
     * near the beginning of the video.
     */
    const firstFrame =
      await captureFirstFrame(
        videoElement
      );


    if (firstFrame) {
      return firstFrame;
    }


    /*
     * If canvas capture fails because
     * of CORS/security restrictions,
     * try the video's poster image.
     */
    const poster =
      videoElement.poster ||
      videoElement.getAttribute("poster");


    if (poster) {
      try {
        return new URL(
          poster,
          window.location.href
        ).href;

      } catch {
        return poster;
      }
    }


    return null;
  }


  async function captureFirstFrame(videoElement) {
    const originalTime =
      videoElement.currentTime;

    const wasPaused =
      videoElement.paused;


    try {
      /*
       * Wait until the browser knows
       * something about the video.
       */
      if (videoElement.readyState < 2) {
        await waitForEvent(
          videoElement,
          "loadeddata",
          2500
        );
      }


      if (
        !videoElement.videoWidth ||
        !videoElement.videoHeight
      ) {
        return null;
      }


      /*
       * Pause temporarily so the frame
       * does not change while capturing.
       */
      if (!wasPaused) {
        videoElement.pause();
      }


      /*
       * 0.1 seconds is used instead of
       * exactly zero because some videos
       * do not decode a visible frame at 0.
       */
      let firstFrameTime = 0.1;


      if (
        Number.isFinite(videoElement.duration) &&
        videoElement.duration > 0
      ) {
        firstFrameTime =
          Math.min(
            0.1,
            videoElement.duration / 2
          );
      }


      const timeDifference =
        Math.abs(
          videoElement.currentTime -
          firstFrameTime
        );


      if (
        videoElement.seekable &&
        videoElement.seekable.length > 0 &&
        timeDifference > 0.05
      ) {
        videoElement.currentTime =
          firstFrameTime;


        await waitForEvent(
          videoElement,
          "seeked",
          2500
        );
      }


      /*
       * Give the browser a moment
       * to paint the decoded frame.
       */
      await delay(100);


      const canvas =
        document.createElement(
          "canvas"
        );


      const maximumWidth = 640;


      const scale =
        Math.min(
          1,
          maximumWidth /
            videoElement.videoWidth
        );


      canvas.width =
        Math.max(
          1,
          Math.round(
            videoElement.videoWidth *
            scale
          )
        );


      canvas.height =
        Math.max(
          1,
          Math.round(
            videoElement.videoHeight *
            scale
          )
        );


      const context =
        canvas.getContext(
          "2d"
        );


      if (!context) {
        return null;
      }


      context.drawImage(
        videoElement,
        0,
        0,
        canvas.width,
        canvas.height
      );


      return canvas.toDataURL(
        "image/jpeg",
        0.82
      );

    } catch (error) {
      /*
       * A common reason for this error
       * is a cross-origin video creating
       * a tainted canvas.
       */
      console.warn(
        "First-frame capture failed:",
        error
      );

      return null;

    } finally {
      /*
       * Put the webpage video back
       * approximately where it was.
       */
      try {
        if (
          Number.isFinite(originalTime) &&
          Math.abs(
            videoElement.currentTime -
            originalTime
          ) > 0.05
        ) {
          videoElement.currentTime =
            originalTime;
        }


        if (!wasPaused) {
          videoElement
            .play()
            .catch(() => {
              /*
               * Some browsers/sites may
               * block programmatic playback.
               */
            });
        }

      } catch (restoreError) {
        console.warn(
          "Could not restore video state:",
          restoreError
        );
      }
    }
  }


  function waitForEvent(
    element,
    eventName,
    timeout
  ) {
    return new Promise(
      (resolve) => {
        let finished = false;


        const finish = () => {
          if (finished) {
            return;
          }

          finished = true;

          clearTimeout(timer);

          element.removeEventListener(
            eventName,
            finish
          );

          resolve();
        };


        const timer =
          setTimeout(
            finish,
            timeout
          );


        element.addEventListener(
          eventName,
          finish,
          {
            once: true
          }
        );
      }
    );
  }


  function delay(milliseconds) {
    return new Promise(
      (resolve) => {
        setTimeout(
          resolve,
          milliseconds
        );
      }
    );
  }
}