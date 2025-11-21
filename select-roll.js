// Select Roll functionality - Stage 3
let qrValue = null;
let allChildRolls = []; // Store all child rolls (available and used)
let rollNumberMap = {}; // Map to maintain consistent roll numbers
let jobNumber = null; // Store job number from step 0
let selectedRollId = null; // Store selected roll ID

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize database
    try {
        await DB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    qrValue = urlParams.get('qr');

    if (!qrValue) {
        showError('No QR code provided');
        return;
    }

    // Get master roll info
    const masterRoll = await DB.masterRolls.getByQR(qrValue);
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

    // Start with step 0 (job number entry)
    document.getElementById('step0').style.display = 'block';
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'none';
});

async function loadAllRolls() {
    // Get ALL child rolls (not just available ones)
    allChildRolls = await DB.childRolls.getByMasterQR(qrValue);
    
    // Sort by creation time or ID to maintain consistent order
    allChildRolls.sort((a, b) => {
        // Sort by createdAt if available, otherwise by ID
        if (a.createdAt && b.createdAt) {
            return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return a.id.localeCompare(b.id);
    });
    
    // Create consistent roll number mapping (1-based index)
    rollNumberMap = {};
    allChildRolls.forEach((roll, index) => {
        rollNumberMap[roll.id] = index + 1;
    });
    
    const availableRolls = allChildRolls.filter(r => r.status === 'AVAILABLE');
    const usedRolls = allChildRolls.filter(r => r.status === 'USED');
    
    const container = document.getElementById('rollsListContainer');

    if (allChildRolls.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">No Rolls Found</h3>
                <p>No child rolls have been created for this master roll yet.</p>
            </div>
        `;
        return;
    }

    if (availableRolls.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">All Rolls Used</h3>
                <p>All rolls from this master roll have already been used.</p>
                <p style="margin-top: 12px;">
                    <strong>Master Roll:</strong> ${qrValue}<br>
                    <strong>Total Rolls:</strong> ${allChildRolls.length}<br>
                    <strong>Used:</strong> ${usedRolls.length}
                </p>
            </div>
        `;
        return;
    }

    // Display all rolls with consistent numbering
    container.innerHTML = `
        <h3 class="form-title" style="font-size: 1.3rem; margin-bottom: 20px;">
            All Rolls (${availableRolls.length} Available / ${allChildRolls.length} Total)
        </h3>
        <p class="form-subtitle" style="margin-bottom: 24px;">
            Select an available roll to mark as used
        </p>
        <div class="rolls-selection-grid">
            ${allChildRolls.map((roll) => {
                const rollNumber = rollNumberMap[roll.id];
                const isAvailable = roll.status === 'AVAILABLE';
                const usedJobId = roll.usedJobId || (roll.jobId && roll.status === 'USED' ? roll.jobId : null);
                
                return `
                <div class="roll-selection-card ${!isAvailable ? 'used-roll' : ''}" ${isAvailable ? `onclick="selectRoll('${roll.id}')"` : ''}>
                    <div class="roll-card-header">
                        <h4>Roll ${rollNumber}</h4>
                        <div class="roll-status-badge ${isAvailable ? 'available' : 'used'}">${isAvailable ? 'AVAILABLE' : 'USED'}</div>
                    </div>
                    <div class="roll-card-body">
                        <div class="roll-size-display">
                            <span class="roll-size-value">${roll.width}</span>
                            <span class="roll-size-unit">mm</span>
                        </div>
                        ${usedJobId ? `<p class="roll-job" style="font-size: 0.85rem; color: var(--gray-600); margin-top: 8px;"><strong>Job:</strong> ${usedJobId}</p>` : ''}
                        ${!isAvailable ? `<p class="roll-id" style="color: var(--gray-500);">Already used</p>` : ''}
                    </div>
                    ${isAvailable ? `
                    <div class="roll-card-footer">
                        <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); selectRoll('${roll.id}');">
                            Select This Roll
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
            }).join('')}
        </div>
    `;
}

async function proceedToRollSelection() {
    const jobInput = document.getElementById('jobNumber');
    const jobValue = jobInput.value.trim();

    if (!jobValue) {
        alert('Please enter a job number');
        return;
    }

    jobNumber = jobValue;

    // Hide step 0, show step 1
    document.getElementById('step0').style.display = 'none';
    document.getElementById('step1').style.display = 'block';

    // Load all rolls
    await loadAllRolls();
}

function goBackToJobNumber() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step0').style.display = 'block';
    document.getElementById('jobNumber').value = '';
    jobNumber = null;
}

async function selectRoll(childRollId) {
    // Find the roll
    const roll = allChildRolls.find(r => r.id === childRollId);
    if (!roll) {
        showError('Roll not found');
        return;
    }

    if (roll.status !== 'AVAILABLE') {
        alert('This roll has already been used.');
        return;
    }

    // Store selected roll ID
    selectedRollId = childRollId;

    // Use the job number from step 0
    if (!jobNumber) {
        alert('Job number is required. Please go back and enter a job number.');
        return;
    }

    try {
        // Mark roll as used with job number
        await DB.childRolls.markAsUsed(childRollId, jobNumber);

        // Log scan event
        await DB.scanEvents.create({
            qrValue: qrValue,
            action: 'roll_selected',
            childRollId: childRollId,
            jobId: jobNumber
        });

        const rollNumber = rollNumberMap[roll.id] || '?';

        // Show success message in step 2
        const successContainer = document.getElementById('successContainer');
        successContainer.innerHTML = `
            <div class="success-message">
                <h3 style="margin-bottom: 12px;">Roll Marked as Used</h3>
                <p><strong>Roll Number:</strong> ${rollNumber}</p>
                <p><strong>Width:</strong> ${roll.width}mm</p>
                <p><strong>Job Number:</strong> ${jobNumber}</p>
                <p><strong>Status:</strong> USED</p>
            </div>
        `;

        // Hide step 1, show step 2
        document.getElementById('step1').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
    } catch (error) {
        console.error('Error marking roll as used:', error);
        showError('Failed to mark roll as used: ' + error.message);
    }
}

function selectAnotherRoll() {
    // Reset and go back to step 0
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step0').style.display = 'block';
    document.getElementById('jobNumber').value = '';
    jobNumber = null;
    selectedRollId = null;
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

