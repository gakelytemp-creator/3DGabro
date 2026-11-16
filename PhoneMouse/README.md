# Mobile phone as a 3DGabro mouse

Experimental phone-to-desktop remote interaction for **3DGabro**. This folder is a snapshot of the supplied working files (17 November 2026), saved separately from the main editor. The goal is to use a phone as an additional input device for manipulating a selected 3D object.

## Files

- `server.js` — Node.js relay/server for the phone page and WebSocket signaling/packet forwarding.
- `phone.html` — mobile controller with touch zones (rotate, move and height), device orientation and connection status.
- `EDITOR_36.html` — the supplied 3DGabro editor snapshot, including the phone-mouse receiver. The uploaded file was named `EDITOR_36 (5).html`; it is archived here as `EDITOR_36.html`.

## Connection topology

```text
Phone browser (HTTPS :8443)
    | WSS: messages + WebRTC signaling
    v
Node.js server.js
    | WS relay
    v
3DGabro EDITOR_36 in desktop browser (ws://localhost:8080)

Phone <---- WebRTC DataChannel ----> Desktop editor
             unordered, maxRetransmits: 0
             when successfully negotiated
```

**Transport precision:** The server does **not** open a raw UDP socket. It serves HTTPS and HTTP and relays WebSocket messages. A WebRTC DataChannel uses an unreliable/unordered mode resembling UDP datagrams and normally communicates over UDP when network negotiation succeeds. WebSocket is the fallback for command packets and carries WebRTC signaling. Press/release state packets are additionally sent over WebSocket.

## Local setup (prototype)

1. Install a recent Node.js release.
2. In this folder, install its two dependencies:
   ```bash
   npm install ws selfsigned
   ```
3. Start the server from this same folder:
   ```bash
   node server.js
   ```
4. On the desktop, open `EDITOR_36.html` in a browser; its receiver connects to `ws://localhost:8080`.
5. Connect the phone to the same trusted local network and open `https://<PC-LAN-IP>:8443` on the phone. The generated certificate is self-signed and will require a browser trust exception. Device-orientation access depends on the browser's permissions and HTTPS/security rules.
6. Use the phone's **rotate**, **move**, and **height** touch areas while a model is selected in the desktop editor. The controller indicates WebSocket/WebRTC and sensor status.

The Node server serves `phone.html` for both ports; the desktop editor is a separate local HTML file. Generated `cert.json` contains a **private key** and must not be committed. `node_modules/` also remains local.

## Current input protocol

Phone packets are JSON with numeric orientation `a` (alpha), `b` (beta), `g` (gamma), button states `k` (rotation), `m` (planar movement), `v` (height), cumulative touch deltas `dx`, `dy`, `dh`, and client timestamp `t`.

The WebSocket channel also relays signaling messages with `rtc` values such as `hello`, `offer`, `answer`, and `ice`. An editor instance and a phone should be paired on a **trusted private network** only; the prototype currently broadcasts WebSocket messages and does not implement authenticated device pairing.

## Status and known limitations

- Archived as an **experimental prototype**, not a production-ready remote input system.
- Requires browser and network verification; no automated multi-device compatibility test is included.
- The self-signed certificate is locally generated and persists as `cert.json`.
- The server has no authentication/authorization, so **do not expose ports 8080 or 8443 to the public Internet**.
- WebRTC connectivity can fail due to browser/network ICE conditions; WebSocket fallback may still work.
- Future work: QR/device pairing, authenticated sessions, more reliable reconnect and orientation calibration, rate limiting, and keeping remote input logic cleanly separated from the CAD core.

This folder intentionally preserves the supplied code unchanged so work can resume later without altering the main 3DGabro editor.
