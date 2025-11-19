// Select Roll functionality - Stage 3
let qrValue = null;
let availableRolls = [];

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    qrValue = urlParams.get('qr');

    if (!qrValue) {
        showError('No QR code provided');
        return;
    }

    // Get master roll info
    const masterRoll = DB.masterRolls.getByQR(qrValue);
    if (!masterRoll) {
        showError('Master roll not found. Please register the master roll first.');
        return;
    }

    // Update header with QR info
    const qrInfo = document.getElementById('qrInfo');
    qrInfo.innerHTML = `
        Choose an available roll to use<br>
        <small style="font-size: 0.85rem; color: var(--gray-600);">
            QR: ${qrValue} | Lot: ${masterRoll.lotNumber} | Stock: ${masterRoll.stockNumber}
        </small>
    `;

    // Load available rolls
    loadAvailableRolls();
});

function loadAvailableRolls() {
    availableRolls = DB.childRolls.getAvailableByMasterQR(qrValue);
    const container = document.getElementById('rollsListContainer');

    if (availableRolls.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">All Rolls Used</h3>
                <p>All rolls from this master roll have already been used.</p>
                <p style="margin-top: 12px;">
                    <strong>Master Roll:</strong> ${qrValue}<br>
                    <strong>Status:</strong> All child rolls consumed
                </p>
            </div>
        `;
        return;
    }

    // Display available rolls
    container.innerHTML = `
        <h3 class="form-title" style="font-size: 1.3rem; margin-bottom: 20px;">
            Available Rolls (${availableRolls.length})
        </h3>
        <p class="form-subtitle" style="margin-bottom: 24px;">
            Select a roll to mark as used
        </p>
        <div class="rolls-selection-grid">
            ${availableRolls.map((roll, index) => `
                <div class="roll-selection-card" onclick="selectRoll('${roll.id}')">
                    <div class="roll-card-header">
                        <h4>Roll ${index + 1}</h4>
                        <div class="roll-status-badge available">AVAILABLE</div>
                    </div>
                    <div class="roll-card-body">
                        <div class="roll-size-display">
                            <span class="roll-size-value">${roll.width}</span>
                            <span class="roll-size-unit">mm</span>
                        </div>
                        <p class="roll-id">ID: ${roll.id.substring(0, 8)}...</p>
                    </div>
                    <div class="roll-card-footer">
                        <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); selectRoll('${roll.id}');">
                            Select This Roll
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function selectRoll(childRollId) {
    // Find the roll
    const roll = availableRolls.find(r => r.id === childRollId);
    if (!roll) {
        showError('Roll not found');
        return;
    }

    // Confirm selection
    if (!confirm(`Mark roll ${roll.width}mm as USED?`)) {
        return;
    }

    // Mark roll as used
    DB.childRolls.markAsUsed(childRollId);

    // Log scan event
    DB.scanEvents.create({
        qrValue: qrValue,
        action: 'roll_selected',
        childRollId: childRollId
    });

    // Show success message
    const messageContainer = document.getElementById('messageContainer');
    messageContainer.innerHTML = `
        <div class="success-message">
            <h3 style="margin-bottom: 12px;">Roll Marked as Used</h3>
            <p><strong>Width:</strong> ${roll.width}mm</p>
            <p><strong>Status:</strong> USED</p>
            <p style="margin-top: 12px; font-size: 0.9rem;">
                This roll has been marked as consumed and will no longer appear in the available list.
            </p>
        </div>
    `;

    // Reload available rolls
    setTimeout(() => {
        loadAvailableRolls();
        messageContainer.innerHTML = '';
    }, 2000);
}

function showError(message) {
    const container = document.getElementById('rollsListContainer');
    container.innerHTML = `
        <div class="error-message">
            <h3 style="margin-bottom: 12px;">Error</h3>
            <p>${message}</p>
        </div>
    `;
}

