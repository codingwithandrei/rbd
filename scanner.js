// In-app QR scanner (camera view inside the page) built on html5-qrcode.
// Needs HTTPS (or localhost) and camera permission, asked once by the browser.
const QRScanner = {
    _scanner: null,
    _lastText: null,
    _lastAt: 0,
    _audio: null,

    // Start the back camera in the element with this ID; onScan(text) runs for each new code
    async start(elementId, onScan) {
        if (typeof Html5Qrcode === 'undefined') {
            throw new Error('The scanner did not load. Check the internet connection and reload.');
        }
        await this.stop();
        this._scanner = new Html5Qrcode(elementId, { verbose: false });
        await this._scanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                // Search the whole frame (no center box) at a higher resolution so small or far labels still read
                videoConstraints: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            },
            (text) => {
                // The same label stays in view for a while; only report it once every few seconds
                const now = Date.now();
                if (text === this._lastText && now - this._lastAt < 3000) return;
                this._lastText = text;
                this._lastAt = now;
                onScan(text);
            },
            () => {} // No code in this frame - normal while aiming
        );
    },

    async stop() {
        if (!this._scanner) return;
        try {
            if (this._scanner.isScanning) {
                await this._scanner.stop();
            }
            this._scanner.clear();
        } catch (error) {
            console.warn('Scanner stop:', error);
        }
        this._scanner = null;
    },

    isRunning() {
        return !!(this._scanner && this._scanner.isScanning);
    },

    // Forget the last code so the same label can be scanned again right away (e.g. after removing it)
    reset() {
        this._lastText = null;
    },

    // Beep and vibrate: one short buzz for a good scan, three for a problem
    feedback(ok) {
        try {
            if (navigator.vibrate) navigator.vibrate(ok ? 80 : [60, 60, 60, 60, 60]);
            this._audio = this._audio || new (window.AudioContext || window.webkitAudioContext)();
            const osc = this._audio.createOscillator();
            const gain = this._audio.createGain();
            osc.frequency.value = ok ? 1200 : 300;
            gain.gain.value = 0.15;
            osc.connect(gain);
            gain.connect(this._audio.destination);
            osc.start();
            osc.stop(this._audio.currentTime + (ok ? 0.12 : 0.35));
        } catch (error) {
            // Sound/vibration not available - the on-screen message is enough
        }
    },

    // Friendly text for camera start errors
    errorMessage(error) {
        const text = String((error && (error.name || error.message)) || error);
        if (/NotAllowed|Permission/i.test(text)) {
            return 'Camera permission was blocked. Allow the camera for this site in the browser settings, or type the label number below.';
        }
        if (/NotFound|no camera|Requested device not found/i.test(text)) {
            return 'No camera found on this device. Type the label number below.';
        }
        if (/secure|https/i.test(text)) {
            return 'The camera only works on the live site (https). Type the label number below.';
        }
        return 'Camera could not start: ' + text;
    }
};
