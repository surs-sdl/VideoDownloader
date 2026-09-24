# Instant Video Downloader

A Manifest V3 Chrome extension that finds the first playable HTML5 video on the current tab, shows a preview of its current frame when available, and starts a user-confirmed download.

## Features

- Detects the first HTML5 `<video>` element on the active page
- Extracts the video’s current source URL
- Shows a thumbnail preview from the current video frame when the page allows it
- Starts a download through Chrome’s native download flow
- Lets you choose where to save the file

## Install locally

1. Download or clone this repository.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.
6. Open a page with a playable HTML5 video, then click the extension icon.
7. Select **DOWNLOAD VIDEO** and choose where to save it.

## How it works

The extension checks the active tab for a `<video>` element and uses its current source URL. If a source is found, the popup enables the download button. It may also draw the current frame to a canvas for the preview.

## Permissions

| Permission | Why it is used |
| --- | --- |
| `activeTab` | Access the page only after you invoke the extension. |
| `scripting` | Inspect video elements and create a preview in the active tab. |
| `downloads` | Start the browser download after you select the button. |
| `<all_urls>` | Allow the extension to run on video pages across sites. |

## Limitations

- Works with direct, browser-accessible HTML5 video sources.
- It does not bypass DRM, paywalls, login restrictions, or a website’s access controls.
- A preview can be unavailable when the page prevents canvas capture, for example because of cross-origin restrictions.
- The saved file name defaults to `video_<timestamp>.mp4`; a source that is not MP4 may need a different extension.
- Always respect the source site’s terms, copyright, and local law.

## Project structure

- `manifest.json` — extension metadata and permissions
- `popup.html` — popup interface
- `popup.js` — video detection, preview, and download logic
- `icon*.png` — extension icons

## Development

After changing a file, return to `chrome://extensions` and click the reload icon for this unpacked extension. Test with a page containing a regular HTML5 video.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, describe how you tested them, and do not add functionality intended to bypass content protections.

## License

No license has been selected yet. Until one is added, the repository’s contents are not offered under an open-source license.
