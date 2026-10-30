// Slitting - Stage 2: each run cuts one length off the master into lanes, and each lane gets a blank label.
// The master keeps its own QR and stays in inventory until its meters run out.
let qrValue = null;       // Master roll QR value from the URL
let masterRoll = null;    // Master roll record
let metersLeft = 0;       // Meters left on the master before this run
let jobNumber = null;
let widths = [];          // Width (mm) per lane, null until chosen
let lengthM = null;       // Length cut for this run
let slots = [];           // Linked label per lane: { code, shortNo } or null
let userEmail = null;
let isSubmitting = false;

let masterWidthMm = DB.MASTER_WIDTH_MM;   // 1300mm, or narrower for an offcut master
let offcutKeep = true;    // Offcut of 158mm+ goes back to inventory unless the operator scraps it
const LENGTH_PRESETS = [100, 500, 1000, 2000, 3000];

document.addEventListener('DOMContentLoaded', async function() {
    // Saving runs needs a signed-in operator, so ask for sign-in before any work is done
    const authenticated = await Auth.requireAuth();
    if (!authenticated) return;

    try {
        await DB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }

    const user = await Auth.getCurrentUser();
    userEmail = user ? user.email : null;

    qrValue = new URLSearchParams(window.location.search).get('qr');
    if (!qrValue) {
        startMasterScan();
        return;
    }

    masterRoll = await DB.masterRolls.getByQR(qrValue);
    if (!masterRoll) {
        showPageMessage(`
            <div class="error-message">
                <h3 style="margin-bottom: 8px;">Master roll not received yet</h3>
                <p>QR: ${qrValue}</p>
                <p style="margin-top: 8px;">Receive it into Inventory first.</p>
            </div>
            <div class="button-group" style="margin-top: 20px;">
                <button class="btn btn-primary" onclick="navigateTo('master-roll.html?qr=${encodeURIComponent(qrValue)}')">Receive Master Roll</button>
            </div>
        `);
        return;
    }

    // Masters slit before meter tracking keep the old one-time flow
    if (!DB.isMeterTracked(masterRoll)) {
        navigateTo(`select-roll.html?qr=${encodeURIComponent(qrValue)}`);
        return;
    }

    metersLeft = DB.metersLeft(masterRoll);
    masterWidthMm = DB.masterWidth(masterRoll);
    await renderMasterSummary();

    if (metersLeft <= 0) {
        showPageMessage(`
            <div class="info-message">
                <h3 style="margin-bottom: 8px;">Master roll used up</h3>
                <p>All ${(masterRoll.lengthTotal || DB.MASTER_LENGTH_M).toLocaleString()} m of this master have been slit. Scan a child roll label to see or update that roll.</p>
            </div>
        `);
        return;
    }

    showStep('stepJob');
    document.getElementById('jobNumber').focus();
});

// ---------- Master summary ----------

async function renderMasterSummary() {
    const total = masterRoll.lengthTotal || DB.MASTER_LENGTH_M;
    document.getElementById('masterIds').textContent = `Lot ${masterRoll.lotNumber} · Stock ${masterRoll.stockNumber} · ${masterWidthMm}mm wide`
        + (masterRoll.isOffcut ? ` (offcut ${masterRoll.labelNo || ''})` : '');
    document.getElementById('metersLeft').textContent = `${metersLeft.toLocaleString()} m`;
    document.getElementById('metersBar').style.width = `${Math.max(0, Math.min(100, metersLeft / total * 100))}%`;
    document.getElementById('masterSummary').style.display = 'block';

    let runs = [];
    try {
        runs = await DB.slitRuns.getByMaster(qrValue);
    } catch (error) {
        console.error('Error loading runs:', error);
    }
    document.getElementById('runHistory').innerHTML = runs.length === 0
        ? '<div style="color: var(--gray-600);">No runs yet. This is the first cut.</div>'
        : runs.map(run => `
            <div class="run-history-item">
                <strong>Run ${run.runNumber}</strong> · Job ${run.jobId} · ${run.lanes} ${run.lanes === 1 ? 'roll' : 'rolls'}
                (${run.widths.join(', ')} mm) × ${run.lengthM} m
                ${run.offcutAction === 'kept' ? `· offcut ${run.offcutWidthMm}mm kept` : run.offcutAction === 'scrapped' ? `· offcut ${run.offcutWidthMm}mm scrapped` : ''}
                <span style="color: var(--gray-600);">· ${run.createdAt ? new Date(run.createdAt).toLocaleDateString() : ''}</span>
            </div>
        `).join('');
}

// ---------- Scan master when opened without a QR ----------

async function startMasterScan() {
    showStep('stepScanMaster');
    const status = document.getElementById('masterScanStatus');
    status.textContent = 'Point the camera at the master roll QR';
    try {
        await QRScanner.start('masterScanner', async (text) => {
            let masterQR = null;
            try {
                masterQR = new URL(text).searchParams.get('qr');
            } catch (e) {
                // Not a URL
            }
            if (!masterQR) {
                // An offcut's roll label works as its master QR
                masterQR = await offcutMasterFromLabel(text);
            }
            if (!masterQR) {
                QRScanner.feedback(false);
                status.className = 'scanner-status bad';
                status.textContent = DB.rollLabels.parse(text) ? 'That is a child roll label. Scan the master roll QR.' : 'Not a master roll QR';
                return;
            }
            QRScanner.feedback(true);
            await QRScanner.stop();
            navigateTo(`job-assignment.html?qr=${encodeURIComponent(masterQR)}`);
        });
    } catch (error) {
        status.className = 'scanner-status bad';
        status.textContent = QRScanner.errorMessage(error);
    }
}

// Typed fallback when the camera can't read the master label
async function submitManualMaster() {
    const value = document.getElementById('manualMaster').value.trim();
    if (!value) return;
    const offcutQR = await offcutMasterFromLabel(value);
    await QRScanner.stop();
    navigateTo(`job-assignment.html?qr=${encodeURIComponent(offcutQR || value)}`);
}

// If the text is an offcut's roll label (scanned or typed like "B-0013"), return its master QR value
async function offcutMasterFromLabel(text) {
    const parsed = DB.rollLabels.parse(text);
    if (!parsed || parsed.otherUrl) return null;
    try {
        const label = await DB.rollLabels.resolve(text);
        return label && label.offcutMasterQR ? label.offcutMasterQR : null;
    } catch (error) {
        console.error('Error checking label:', error);
        return null;
    }
}

// ---------- Step 1: job number ----------

function goToRunDetails() {
    const value = document.getElementById('jobNumber').value.trim();
    if (!value) {
        alert('Please enter a job number');
        return;
    }
    jobNumber = value;
    renderLengthOptions();
    showStep('stepRun');
}

// ---------- Step 2: lanes, widths, length ----------

function buildLanes() {
    const count = parseInt(document.getElementById('laneCount').value, 10);
    const container = document.getElementById('lanesContainer');
    if (!count || count < 1 || count > 20) {
        container.innerHTML = '';
        widths = [];
        updateWidthTotal();
        return;
    }

    // Keep widths already chosen when the lane count changes
    widths = Array.from({ length: count }, (_, i) => widths[i] || null);
    container.innerHTML = widths.map((width, i) => {
        const isCustom = width && !DB.PRINT_SIZES.includes(width);
        return `
            <div class="roll-entry" id="lane-${i}">
                <div class="form-group">
                    <label class="form-label">Roll ${i + 1} width</label>
                    <div class="size-select-group">
                        ${DB.PRINT_SIZES.map(size => `
                            <div class="size-option ${width === size ? 'selected' : ''}" onclick="selectWidth(${i}, ${size}, this)">${size}mm</div>
                        `).join('')}
                        <div class="size-option ${isCustom ? 'selected' : ''}" onclick="selectCustomWidth(${i}, this)">Custom</div>
                    </div>
                    <div id="custom-input-${i}" class="custom-size-input" style="display: ${isCustom ? 'block' : 'none'};">
                        <input type="number" id="custom-size-${i}" class="form-input" min="1" max="${masterWidthMm}" inputmode="numeric"
                            placeholder="Custom width (mm)" value="${isCustom ? width : ''}" oninput="setCustomWidth(${i})">
                    </div>
                </div>
            </div>
        `;
    }).join('');
    // One-tap fill: copy roll 1's width to every lane
    if (count > 1) {
        container.insertAdjacentHTML('beforeend', `
            <button type="button" class="btn btn-secondary btn-small" style="margin: -8px 0 16px;" onclick="copyFirstWidth()">Same width for all rolls</button>
        `);
    }
    updateWidthTotal();
}

function selectWidth(i, size, element) {
    document.querySelectorAll(`#lane-${i} .size-option`).forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById(`custom-input-${i}`).style.display = 'none';
    document.getElementById(`custom-size-${i}`).value = '';
    widths[i] = size;
    updateWidthTotal();
}

function selectCustomWidth(i, element) {
    document.querySelectorAll(`#lane-${i} .size-option`).forEach(opt => opt.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById(`custom-input-${i}`).style.display = 'block';
    document.getElementById(`custom-size-${i}`).focus();
    widths[i] = null;
    updateWidthTotal();
}

function setCustomWidth(i) {
    const size = parseInt(document.getElementById(`custom-size-${i}`).value, 10);
    widths[i] = size > 0 && size <= masterWidthMm ? size : null;
    updateWidthTotal();
}

function copyFirstWidth() {
    if (!widths[0]) {
        alert('Choose a width for roll 1 first');
        return;
    }
    widths = widths.map(() => widths[0]);
    buildLanes();
}

function updateWidthTotal() {
    const total = widths.reduce((sum, w) => sum + (w || 0), 0);
    const el = document.getElementById('widthTotal');
    if (widths.length === 0) {
        el.textContent = '';
        return;
    }
    if (total > masterWidthMm) {
        el.innerHTML = `<span style="color: var(--error-red); font-weight: 600;">Total ${total}mm is more than the ${masterWidthMm}mm master width</span>`;
        return;
    }
    const offcut = masterWidthMm - total;
    el.innerHTML = `Total width: ${total}mm of ${masterWidthMm}mm` + (widths.some(w => !w) ? '' : ` · <strong>${offcutText(offcut)}</strong>`);
}

// Leftover width after the lanes (only meaningful once every lane has a width)
function offcutWidth() {
    return masterWidthMm - widths.reduce((sum, w) => sum + (w || 0), 0);
}

function offcutText(offcut) {
    if (offcut <= 0) return 'no offcut';
    if (offcut < DB.OFFCUT_MIN_MM) return `offcut ${offcut}mm → scrap (under ${DB.OFFCUT_MIN_MM}mm)`;
    return `offcut ${offcut}mm → back to inventory`;
}

// The offcut needs its own label slot when it's big enough and not scrapped
function offcutHasSlot() {
    return offcutWidth() >= DB.OFFCUT_MIN_MM && offcutKeep;
}

function renderLengthOptions() {
    const presets = LENGTH_PRESETS.filter(m => m < metersLeft);
    document.getElementById('lengthOptions').innerHTML = [
        ...presets.map(m => `<div class="size-option ${lengthM === m ? 'selected' : ''}" onclick="setLength(${m}, this)">${m.toLocaleString()} m</div>`),
        `<div class="size-option ${lengthM === metersLeft ? 'selected' : ''}" onclick="setLength(${metersLeft}, this)">All left (${metersLeft.toLocaleString()} m)</div>`
    ].join('');
}

// element is the clicked preset, or null when typed
function setLength(meters, element) {
    lengthM = meters > 0 ? meters : null;
    document.querySelectorAll('#lengthOptions .size-option').forEach(opt => opt.classList.remove('selected'));
    if (element) {
        element.classList.add('selected');
        document.getElementById('lengthCustom').value = '';
    }
}

function runError(message) {
    document.getElementById('runError').innerHTML = message ? `<div class="error-message">${message}</div>` : '';
}

function goToLinkLabels() {
    runError('');
    if (widths.length === 0) return runError('Enter the number of rolls.');
    if (widths.some(w => !w)) return runError('Choose a width for every roll.');
    const total = widths.reduce((sum, w) => sum + w, 0);
    if (total > masterWidthMm) return runError(`Total width ${total}mm is more than the ${masterWidthMm}mm master.`);
    if (!lengthM) return runError('Choose or type the length cut.');
    if (lengthM > metersLeft) return runError(`Only ${metersLeft.toLocaleString()} m left on this master.`);

    // Keep labels already scanned if the lanes (and offcut slot) didn't change
    const slotCount = widths.length + (offcutHasSlot() ? 1 : 0);
    slots = slots.length === slotCount ? slots : Array.from({ length: slotCount }, () => null);
    document.getElementById('linkSummary').textContent =
        `Job ${jobNumber} · ${widths.length} ${widths.length === 1 ? 'roll' : 'rolls'} × ${lengthM.toLocaleString()} m. Stick a blank label on each roll and scan it.`;
    document.getElementById('finishError').innerHTML = '';
    showStep('stepLink');
    renderOffcutPanel();
    renderSlots();
    startLabelScan();
}

// Offcut: under 158mm is scrap; 158mm+ goes back to inventory (needs a label + stock number) unless scrapped
function renderOffcutPanel() {
    const offcut = offcutWidth();
    const panel = document.getElementById('offcutPanel');
    if (offcut <= 0) {
        panel.innerHTML = '';
        return;
    }
    if (offcut < DB.OFFCUT_MIN_MM) {
        panel.innerHTML = `<div class="info-message">Offcut <strong>${offcut}mm</strong> is under ${DB.OFFCUT_MIN_MM}mm, so it's scrapped.</div>`;
        return;
    }
    panel.innerHTML = offcutKeep ? `
        <div class="info-message">
            <p><strong>Offcut ${offcut}mm × ${lengthM.toLocaleString()} m</strong> goes back to inventory as a new master roll (lot ${masterRoll.lotNumber}). Label it like the other rolls.</p>
            <p style="margin: 8px 0 12px;">Stock number: <strong id="offcutStock">…</strong></p>
            <button type="button" class="btn btn-secondary btn-small" onclick="toggleOffcut()">Scrap it instead</button>
        </div>
    ` : `
        <div class="info-message">
            <p>Offcut <strong>${offcut}mm</strong> will be scrapped.</p>
            <button type="button" class="btn btn-secondary btn-small" style="margin-top: 8px;" onclick="toggleOffcut()">Keep it instead</button>
        </div>
    `;
    if (offcutKeep) {
        DB.nextOffcutStockNumber(offcut)
            .then(stock => {
                const el = document.getElementById('offcutStock');
                if (el) el.textContent = stock;
            })
            .catch(error => console.error('Error loading next offcut stock number:', error));
    }
}

function toggleOffcut() {
    offcutKeep = !offcutKeep;
    if (offcutKeep) {
        slots.push(null);
    } else {
        slots.pop(); // frees the offcut's label if one was scanned
    }
    QRScanner.reset();
    renderOffcutPanel();
    renderSlots();
    startLabelScan();
}

function backToRunDetails() {
    QRScanner.stop();
    showStep('stepRun');
}

// ---------- Step 3: link blank labels ----------

function currentSlotIndex() {
    return slots.findIndex(s => !s);
}

// Slots are the lanes in order, then the offcut (when it's kept)
function slotName(i) {
    return i < widths.length ? `Roll ${i + 1}` : 'Offcut';
}

function slotWidth(i) {
    return i < widths.length ? widths[i] : offcutWidth();
}

function renderSlots() {
    const current = currentSlotIndex();
    document.getElementById('labelSlots').innerHTML = slots.map((slot, i) => `
        <div class="label-slot ${slot ? 'filled' : (i === current ? 'current' : '')}">
            <span>${slotName(i)} · ${slotWidth(i)}mm × ${lengthM.toLocaleString()} m</span>
            ${slot
                ? `<span>✅ <strong>${slot.shortNo}</strong> <button type="button" class="slot-remove" title="Remove" onclick="removeSlot(${i})">✕</button></span>`
                : `<span>${i === current ? 'Scan a label…' : 'Waiting'}</span>`}
        </div>
    `).join('');
    document.getElementById('finishRunBtn').disabled = current !== -1;
}

function setScanStatus(text, kind) {
    const status = document.getElementById('labelScanStatus');
    status.className = `scanner-status ${kind || ''}`;
    status.textContent = text;
}

async function startLabelScan() {
    if (currentSlotIndex() === -1) {
        setScanStatus('All rolls labeled. Tap Finish Run.', 'ok');
        return;
    }
    setScanStatus(`${slotName(currentSlotIndex())} (${currentSlotIndex() + 1} of ${slots.length}): point at a blank label`);
    if (QRScanner.isRunning()) return;
    try {
        await QRScanner.start('labelScanner', handleLabelScan);
    } catch (error) {
        setScanStatus(QRScanner.errorMessage(error), 'bad');
    }
}

// Handle scans one at a time so two quick scans can't land in the same slot
let scanQueue = Promise.resolve();
function handleLabelScan(text) {
    scanQueue = scanQueue.then(() => checkAndLinkLabel(text)).catch(error => console.error('Label scan error:', error));
    return scanQueue;
}

// Check a scanned or typed label and put it in the next empty slot
async function checkAndLinkLabel(text) {
    const index = currentSlotIndex();
    if (index === -1) return;

    const parsed = DB.rollLabels.parse(text);
    if (!parsed || parsed.otherUrl) {
        QRScanner.feedback(false);
        let isMaster = false;
        try {
            isMaster = !!new URL(text).searchParams.get('qr');
        } catch (e) {
            // Not a URL
        }
        setScanStatus(isMaster ? 'That is the master roll QR. Scan a blank roll label.' : 'Not one of our roll labels', 'bad');
        return;
    }

    let label;
    try {
        label = await DB.rollLabels.resolve(text);
    } catch (error) {
        QRScanner.feedback(false);
        setScanStatus('Could not check the label: ' + error.message, 'bad');
        return;
    }
    if (!label) {
        QRScanner.feedback(false);
        setScanStatus(`${parsed.shortNo || parsed.code} is not one of our roll labels`, 'bad');
        return;
    }

    const already = slots.findIndex(s => s && s.code === label.id);
    if (already !== -1) {
        // Same label still in front of the camera - not an error
        setScanStatus(`${label.shortNo} is already on ${slotName(already).toLowerCase()}. Scan the next label.`);
        return;
    }
    if (label.status !== DB.LABEL_STATUS.BLANK) {
        QRScanner.feedback(false);
        setScanStatus(`${label.shortNo} is already on another roll. Use a different label.`, 'bad');
        return;
    }

    slots[index] = { code: label.id, shortNo: label.shortNo };
    QRScanner.feedback(true);
    renderSlots();

    if (currentSlotIndex() === -1) {
        await QRScanner.stop();
        setScanStatus('All rolls labeled. Tap Finish Run.', 'ok');
    } else {
        setScanStatus(`✅ ${label.shortNo} → ${slotName(index)}. Now ${slotName(currentSlotIndex()).toLowerCase()} (${currentSlotIndex() + 1} of ${slots.length}).`, 'ok');
    }
}

function submitManualCode() {
    const input = document.getElementById('manualCode');
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    handleLabelScan(value);
}

function removeSlot(i) {
    slots[i] = null;
    QRScanner.reset();
    renderSlots();
    startLabelScan();
}

// ---------- Step 4: save ----------

async function finishRun() {
    if (isSubmitting || currentSlotIndex() !== -1) return;

    const keepOffcut = offcutHasSlot();

    isSubmitting = true;
    const button = document.getElementById('finishRunBtn');
    button.disabled = true;
    button.textContent = 'Saving...';
    document.getElementById('finishError').innerHTML = '';

    try {
        const result = await DB.slitRuns.finish({
            masterRollQR: qrValue,
            jobId: jobNumber,
            widths: widths,
            lengthM: lengthM,
            labelCodes: slots.slice(0, widths.length).map(s => s.code),
            offcut: {
                keep: keepOffcut,
                labelCode: keepOffcut ? slots[widths.length].code : null
            },
            userEmail: userEmail
        });

        await DB.scanEvents.create({
            qrValue: qrValue,
            action: 'slitting',
            jobId: jobNumber,
            department: DB.DEPARTMENTS.SLITTING
        });

        await QRScanner.stop();
        document.getElementById('doneDetails').innerHTML = `
            <p><strong>Run ${result.runNumber}</strong> · Job ${jobNumber}</p>
            <p>${widths.length} ${widths.length === 1 ? 'roll' : 'rolls'} × ${lengthM.toLocaleString()} m</p>
            <ul style="margin: 12px 0 12px 20px;">
                ${slots.slice(0, widths.length).map((s, i) => `<li>${s.shortNo}: ${widths[i]}mm</li>`).join('')}
            </ul>
            ${result.offcutAction === 'kept' ? `<p>Offcut ${result.offcutWidth}mm × ${lengthM.toLocaleString()} m → back to inventory as ${slots[widths.length].shortNo} (stock ${result.offcutStockNumber})</p>` : ''}
            ${result.offcutAction === 'scrapped' ? `<p>Offcut ${result.offcutWidth}mm scrapped</p>` : ''}
            <p style="font-size: 1.15rem;"><strong>Master now has ${result.remaining.toLocaleString()} m left</strong></p>
            ${result.remaining === 0 ? '<p style="margin-top: 8px;">This master roll is used up.</p>' : ''}
        `;
        if (result.remaining === 0) {
            document.getElementById('anotherRunBtn').style.display = 'none';
        }
        document.getElementById('masterSummary').style.display = 'none';
        showStep('stepDone');
    } catch (error) {
        console.error('Error saving run:', error);
        document.getElementById('finishError').innerHTML = `
            <div class="error-message">
                <p><strong>Not saved.</strong> ${error.message}</p>
                <p style="margin-top: 8px; font-size: 0.9rem;">Nothing was changed. Fix the problem and tap Finish Run again.</p>
            </div>
        `;
        button.disabled = false;
    } finally {
        isSubmitting = false;
        button.textContent = 'Finish Run';
    }
}

// ---------- Helpers ----------

function showStep(id) {
    ['stepScanMaster', 'stepJob', 'stepRun', 'stepLink', 'stepDone'].forEach(step => {
        document.getElementById(step).style.display = step === id ? 'block' : 'none';
    });
}

function showPageMessage(html) {
    document.getElementById('pageMessage').innerHTML = html;
}
