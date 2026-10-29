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
                        ${!isAvailable ? `<p class="roll-id" style="color: var(--gray-500);">${roll.printed ? 'Sent to Printing' : 'Already used'}</p>` : ''}
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

    // Ask where the roll is going. Default sizes fit the print presses, so suggest Printing for those
    const likelyPrinting = DB.PRINT_SIZES.includes(Number(roll.width));
    const btnPrinting = document.getElementById('btnPrinting');
    const btnProduction = document.getElementById('btnProduction');
    btnPrinting.className = `btn btn-block destination-btn ${likelyPrinting ? 'btn-primary' : 'btn-secondary'}`;
    btnProduction.className = `btn btn-block destination-btn ${likelyPrinting ? 'btn-secondary' : 'btn-primary'}`;
    btnPrinting.disabled = false;
    btnProduction.disabled = false;
    document.getElementById('hintPrinting').textContent = likelyPrinting ? 'Suggested: press size' : '';
    document.getElementById('hintProduction').textContent = likelyPrinting ? '' : 'Suggested: custom size';
    document.getElementById('destinationRollInfo').innerHTML =
        `Roll ${rollNumberMap[roll.id] || '?'} &middot; ${roll.width}mm &middot; Job ${jobNumber}`;
    document.getElementById('destinationMessage').innerHTML = '';

    document.getElementById('step1').style.display = 'none';
    document.getElementById('stepDestination').style.display = 'block';
}

// Save the selected roll as used, going to Printing or Production (both are final steps)
async function confirmDestination(department) {
    const roll = allChildRolls.find(r => r.id === selectedRollId);
    if (!roll) {
        showError('Roll not found');
        return;
    }

    // Prevent double taps while saving
    document.getElementById('btnPrinting').disabled = true;
    document.getElementById('btnProduction').disabled = true;

    try {
        // Mark roll as used with job number and where it went
        await DB.childRolls.markAsUsed(selectedRollId, jobNumber, department);

        // Log scan event
        await DB.scanEvents.create({
            qrValue: qrValue,
            action: department === DB.DEPARTMENTS.PRINTING ? 'sent_to_printing' : 'roll_selected',
            childRollId: selectedRollId,
            jobId: jobNumber,
            department: department
        });

        const rollNumber = rollNumberMap[roll.id] || '?';
        const toPrinting = department === DB.DEPARTMENTS.PRINTING;

        // Show success message in step 2
        const successContainer = document.getElementById('successContainer');
        successContainer.innerHTML = `
            <div class="success-message">
                <h3 style="margin-bottom: 12px;">${toPrinting ? 'Roll Sent to Printing' : 'Roll Marked as Used'}</h3>
                <p><strong>Roll Number:</strong> ${rollNumber}</p>
                <p><strong>Width:</strong> ${roll.width}mm</p>
                <p><strong>Job Number:</strong> ${jobNumber}</p>
                <p><strong>Department:</strong> ${department}</p>
                <p><strong>Status:</strong> USED</p>
            </div>
        `;

        document.getElementById('stepDestination').style.display = 'none';
        document.getElementById('step2').style.display = 'block';
    } catch (error) {
        console.error('Error marking roll as used:', error);
        document.getElementById('destinationMessage').innerHTML = `
            <div class="error-message" style="margin-top: 20px;">
                <p><strong>Not saved.</strong> ${error.message}</p>
                <p style="margin-top: 8px; font-size: 0.9rem;">If this says "permissions", sign in on this device and scan again.</p>
            </div>
        `;
        document.getElementById('btnPrinting').disabled = false;
        document.getElementById('btnProduction').disabled = false;
    }
}

function backToRollList() {
    document.getElementById('stepDestination').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    selectedRollId = null;
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

