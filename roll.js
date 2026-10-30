// Roll page - opened by scanning a child roll label (index.html?label=CODE redirects here).
// Shows the roll's size, length, lot and stock; signed-in workers can send it on and reprint the label.
let label = null;
let roll = null;
let signedIn = false;

document.addEventListener('DOMContentLoaded', async function() {
    try {
        await DB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }

    const code = new URLSearchParams(window.location.search).get('label');
    if (!code) {
        showRollMessage('error', 'No label', 'Scan a roll label to open this page.');
        return;
    }

    signedIn = !!(await Auth.getCurrentUser());

    try {
        label = await DB.rollLabels.get(code.toUpperCase());
        // Signed-in workers can also open a label by its printed number (e.g. B-0001); the full hidden code is still
        // needed when signed out, so labels can't be looked up by guessing numbers
        if (!label && signedIn) {
            label = await DB.rollLabels.resolve(code);
        }
    } catch (error) {
        console.error('Error loading label:', error);
        showRollMessage('error', 'Could not load this label', error.message);
        return;
    }

    if (!label) {
        const parsed = DB.rollLabels.parse(code);
        if (!signedIn && parsed && parsed.shortNo) {
            showRollMessage('info', 'Sign in to look up a label by number', 'Scan the label\'s QR code, or sign in to open it by its number.');
            document.getElementById('rollButtons').innerHTML = '<button type="button" class="btn btn-primary" onclick="signInToUpdate()">Sign In</button>';
            return;
        }
        showRollMessage('error', 'Not one of our labels', `The code ${code} is not an RBD roll label.`);
        return;
    }

    document.getElementById('rollTitle').textContent = `Roll ${label.shortNo}`;

    // Offcut label: this roll is a master roll in its own right
    if (label.status === DB.LABEL_STATUS.LINKED && label.offcutMasterQR) {
        await loadOffcut();
        return;
    }

    if (label.status !== DB.LABEL_STATUS.LINKED || !label.childRollId) {
        document.getElementById('rollSubtitle').textContent = 'Blank label';
        showRollMessage('info', 'Not assigned yet', `${label.shortNo} isn't assigned to a roll yet. It gets linked when a master roll is slit.`);
        return;
    }

    await loadRoll();
});

async function loadRoll() {
    try {
        roll = await DB.childRolls.getById(label.childRollId);
    } catch (error) {
        console.error('Error loading roll:', error);
        showRollMessage('error', 'Could not load this roll', error.message);
        return;
    }
    if (!roll) {
        showRollMessage('error', 'Roll not found', `${label.shortNo} is linked, but its roll record is missing.`);
        return;
    }
    renderRoll();
}

// Offcut kept from a slitting run - shown with its meters left, and can be slit like any master
async function loadOffcut() {
    let offcut;
    try {
        offcut = await DB.masterRolls.getByQR(label.offcutMasterQR);
    } catch (error) {
        showRollMessage('error', 'Could not load this offcut', error.message);
        return;
    }
    if (!offcut) {
        showRollMessage('error', 'Offcut not found', `${label.shortNo} is linked, but its offcut record is missing.`);
        return;
    }

    const left = DB.metersLeft(offcut);
    document.getElementById('rollSubtitle').textContent = `Offcut · ${offcut.widthMm}mm × ${left.toLocaleString()} m left`;
    const items = [
        ['Width', `${offcut.widthMm} mm`],
        ['Meters left', `${left.toLocaleString()} of ${offcut.lengthTotal.toLocaleString()} m`],
        ['Lot', offcut.lotNumber],
        ['Stock', offcut.stockNumber],
        ['Status', left > 0 ? 'In inventory (offcut master)' : 'Used up'],
        ['Created', offcut.createdAt ? new Date(offcut.createdAt).toLocaleDateString() : '-']
    ];
    if (signedIn) {
        items.push(['Cut from master', offcut.parentMasterQR]);
    }
    document.getElementById('rollInfo').innerHTML = `
        <div class="roll-info-grid">
            ${items.map(([k, v]) => `<div class="roll-info-item"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
        </div>
    `;

    // Reprint uses the same label layout as child rolls
    roll = { width: offcut.widthMm, lengthM: offcut.lengthTotal, lotNumber: offcut.lotNumber, stockNumber: offcut.stockNumber, createdAt: offcut.createdAt, isOffcut: true };
    document.getElementById('rollButtons').innerHTML = signedIn
        ? `
            ${left > 0 ? `<button type="button" class="btn btn-primary" onclick="navigateTo('job-assignment.html?qr=${encodeURIComponent(offcut.qrValue)}')">Slit This Offcut</button>` : ''}
            <button type="button" class="btn btn-yellow" onclick="reprintLabel()">Reprint Label</button>
        `
        : `
            <button type="button" class="btn btn-primary" onclick="signInToUpdate()">Sign in to update this roll</button>
        `;
}

function statusText(r) {
    if (r.status === 'AVAILABLE') return 'Available (at Slitting)';
    return r.printed ? 'Sent to Printing' : 'Used for Job';
}

function renderRoll() {
    document.getElementById('rollSubtitle').textContent = `${roll.width}mm × ${roll.lengthM} m`;
    document.getElementById('rollMessage').innerHTML = '';

    const items = [
        ['Size', `${roll.width} mm`],
        ['Length', `${roll.lengthM} m`],
        ['Lot', roll.lotNumber],
        ['Stock', roll.stockNumber],
        ['Status', statusText(roll)],
        ['Slit date', roll.createdAt ? new Date(roll.createdAt).toLocaleDateString() : '-']
    ];
    // Job numbers and history are for workers only
    if (signedIn) {
        items.push(['Slit for job', roll.jobId || '-']);
        if (roll.usedJobId) items.push(['Used on job', roll.usedJobId]);
        if (roll.usedAt) items.push(['Used', new Date(roll.usedAt).toLocaleString()]);
        items.push(['Master roll', `${roll.masterRollQR} · run ${roll.runNumber}, roll ${roll.lane}`]);
    }

    document.getElementById('rollInfo').innerHTML = `
        <div class="roll-info-grid">
            ${items.map(([k, v]) => `<div class="roll-info-item"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
        </div>
    `;

    const actions = document.getElementById('rollActions');
    if (signedIn && roll.status === 'AVAILABLE') {
        // Default sizes fit the print presses, so suggest Printing for those
        const likelyPrinting = DB.PRINT_SIZES.includes(Number(roll.width));
        document.getElementById('btnPrinting').className = `btn btn-block destination-btn ${likelyPrinting ? 'btn-primary' : 'btn-secondary'}`;
        document.getElementById('btnProduction').className = `btn btn-block destination-btn ${likelyPrinting ? 'btn-secondary' : 'btn-primary'}`;
        document.getElementById('hintPrinting').textContent = likelyPrinting ? 'Suggested: press size' : '';
        document.getElementById('hintProduction').textContent = likelyPrinting ? '' : 'Suggested: custom size';
        document.getElementById('useJobNumber').value = roll.jobId || '';
        actions.style.display = 'block';
    } else {
        actions.style.display = 'none';
    }

    document.getElementById('rollButtons').innerHTML = signedIn
        ? `
            <button type="button" class="btn btn-yellow" onclick="reprintLabel()">Reprint Label</button>
            <button type="button" class="btn btn-secondary" onclick="navigateTo('index.html')">Home</button>
        `
        : `
            <button type="button" class="btn btn-primary" onclick="signInToUpdate()">Sign in to update this roll</button>
        `;
}

// Send the roll to Printing or Production (both are final steps)
async function confirmDestination(department) {
    const job = document.getElementById('useJobNumber').value.trim();
    const message = document.getElementById('actionMessage');
    if (!job) {
        message.innerHTML = '<div class="error-message" style="margin-top: 16px;">Please enter a job number.</div>';
        return;
    }

    // Prevent double taps while saving
    document.getElementById('btnPrinting').disabled = true;
    document.getElementById('btnProduction').disabled = true;
    message.innerHTML = '';

    try {
        await DB.childRolls.markAsUsed(roll.id, job, department);
        await DB.scanEvents.create({
            qrValue: roll.masterRollQR,
            action: department === DB.DEPARTMENTS.PRINTING ? 'sent_to_printing' : 'roll_selected',
            childRollId: roll.id,
            jobId: job,
            department: department
        });
        await loadRoll();
        document.getElementById('rollMessage').innerHTML = `
            <div class="success-message" style="margin-bottom: 20px;">
                <strong>${department === DB.DEPARTMENTS.PRINTING ? 'Sent to Printing' : 'Marked as used for job'} ${job}.</strong>
            </div>
        `;
    } catch (error) {
        console.error('Error updating roll:', error);
        message.innerHTML = `
            <div class="error-message" style="margin-top: 20px;">
                <p><strong>Not saved.</strong> ${error.message}</p>
                <p style="margin-top: 8px; font-size: 0.9rem;">If this says "permissions", sign in on this device and scan again.</p>
            </div>
        `;
    } finally {
        document.getElementById('btnPrinting').disabled = false;
        document.getElementById('btnProduction').disabled = false;
    }
}

function reprintLabel() {
    RollLabelPrint.print([{ label: label, roll: roll }]);
}

function signInToUpdate() {
    sessionStorage.setItem('redirectAfterLogin', window.location.pathname + window.location.search);
    navigateTo('login.html');
}

function showRollMessage(kind, title, text) {
    const cls = kind === 'error' ? 'error-message' : 'info-message';
    document.getElementById('rollMessage').innerHTML = `
        <div class="${cls}">
            <h3 style="margin-bottom: 8px;">${title}</h3>
            <p>${text}</p>
        </div>
    `;
    if (document.getElementById('rollSubtitle').textContent === 'Loading…') {
        document.getElementById('rollSubtitle').textContent = '';
    }
}
