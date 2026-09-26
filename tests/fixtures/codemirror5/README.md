Test-only copies of CodeMirror 5.65.16, the app's pinned runtime version.
Downloaded unchanged from:

- https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js
- https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css
- https://raw.githubusercontent.com/codemirror/codemirror5/5.65.16/LICENSE

The keyboard layout test serves these at the existing CDN URLs. Production
still loads the CDN and has no build step or vendored runtime dependency.
