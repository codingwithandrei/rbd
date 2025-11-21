// Job Assignment functionality - Stage 2
let numberOfRolls = 0;
let rolls = [];
let currentRollIndex = 0;
let qrValue = null; // Store QR value from URL
let jobNumber = null; // Store job number
let masterRoll = null; // Store master roll data
let isSubmitting = false; // Guard against double submission

const PRESET_SIZES = [225, 241, 325];
const MAX_TOTAL_SIZE = 1300;

// Initialize: Get QR value and verify master roll
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize database
    try {
        await DB.init();
    } catch (error) {
        console.error('Failed to initialize database:', error);
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    qrValue = urlParams.get('qr');

    if (qrValue) {
        // Verify master roll exists and is in correct stage
        masterRoll = await DB.masterRolls.getByQR(qrValue);
        
        if (!masterRoll) {
            // Check if QR code exists in database
            const qrCode = await DB.qrCodes.getByValue(qrValue);
            if (qrCode) {
                // Auto-fill lot and stock from QR code
                document.getElementById('lotNumber').value = qrCode.lotNumber || '';
                document.getElementById('stockNumber').value = qrCode.stockNumber || '';
                
                // Show warning
                const messageContainer = document.createElement('div');
                messageContainer.id = 'qrWarningContainer';
                messageContainer.style.marginBottom = '20px';
                messageContainer.innerHTML = `
                    <div class="error-message" style="margin-bottom: 0;">
                        <p><strong>Warning:</strong> Master roll not found for QR: ${qrValue}</p>
                        <p style="margin-top: 8px; font-size: 0.9rem;">Please register this master roll first before assigning a job.</p>
                    </div>
                `;
                document.querySelector('.form-container').insertBefore(messageContainer, document.querySelector('#step0'));
            } else {
                alert('QR code not found in database. Please generate this QR code first.');
                navigateTo('index.html');
                return;
            }
        } else {
            // Master roll exists - auto-fill lot and stock
            document.getElementById('lotNumber').value = masterRoll.lotNumber || '';
            document.getElementById('stockNumber').value = masterRoll.stockNumber || '';
            
            // Check if already slit
            if (masterRoll.status !== 'registered') {
                const childRolls = await DB.childRolls.getByMasterQR(qrValue);
                if (childRolls.length > 0) {
                    alert('This master roll has already been slit. Redirecting to roll selection...');
                    navigateTo(`select-roll.html?qr=${encodeURIComponent(qrValue)}`);
                    return;
                }
            }

            // Show QR code info
            const header = document.querySelector('.header .subtitle');
            if (header) {
                header.innerHTML = `Split master roll into production rolls<br><small style="font-size: 0.85rem; color: var(--gray-600);">QR: ${qrValue} | Lot: ${masterRoll.lotNumber} | Stock: ${masterRoll.stockNumber}</small>`;
            }
        }
    } else {
        // No QR code - allow manual entry for editing
        // Make lot and stock fields editable
        const lotInput = document.getElementById('lotNumber');
        const stockInput = document.getElementById('stockNumber');
        
        if (lotInput) {
            lotInput.readOnly = false;
            lotInput.style.backgroundColor = 'var(--white)';
            lotInput.style.cursor = 'text';
            lotInput.placeholder = 'Enter lot number';
        }
        
        if (stockInput) {
            stockInput.readOnly = false;
            stockInput.style.backgroundColor = 'var(--white)';
            stockInput.style.cursor = 'text';
            stockInput.placeholder = 'Enter stock number';
        }
        
        // Show info message for manual entry
        const messageContainer = document.createElement('div');
        messageContainer.id = 'manualEntryContainer';
        messageContainer.style.marginBottom = '20px';
        messageContainer.innerHTML = `
            <div class="info-message" style="margin-bottom: 0;">
                <p><strong>Manual Entry Mode</strong></p>
                <p style="margin-top: 8px; font-size: 0.9rem;">Enter lot and stock numbers manually, or scan a QR code to auto-fill.</p>
            </div>
        `;
        document.querySelector('.form-container').insertBefore(messageContainer, document.querySelector('#step0'));
        
        // Update header
        const header = document.querySelector('.header .subtitle');
        if (header) {
            header.innerHTML = 'Split master roll into production rolls (Manual Entry)';
        }
    }
});

function proceedToNumberOfRolls() {
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
}

function proceedToRollSizes() {
    const input = document.getElementById('numberOfRolls');
    const value = parseInt(input.value);

    if (!value || value < 1) {
        alert('Please enter a valid number of rolls (minimum 1)');
        return;
    }

    numberOfRolls = value;
    rolls = [];
    currentRollIndex = 0;

    // Hide step 1, show step 2
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';

    // Generate roll entry forms
    generateRollEntries();
}

function generateRollEntries() {
    const container = document.getElementById('rollsContainer');
    container.innerHTML = '';

    for (let i = 0; i < numberOfRolls; i++) {
        const rollDiv = document.createElement('div');
        rollDiv.className = 'roll-entry';
        rollDiv.id = `roll-${i}`;
        rollDiv.innerHTML = `
            <div class="form-group">
                <label class="form-label">Roll ${i + 1} - Select Size</label>
                <div class="size-select-group">
                    <div class="size-option" onclick="selectSize(${i}, 225, this)">225mm</div>
                    <div class="size-option" onclick="selectSize(${i}, 241, this)">241mm</div>
                    <div class="size-option" onclick="selectSize(${i}, 325, this)">325mm</div>
                    <div class="size-option" onclick="selectCustom(${i}, this)">Custom</div>
                </div>
                <div id="custom-input-${i}" class="custom-size-input" style="display: none;">
                    <input 
                        type="number" 
                        id="custom-size-${i}" 
                        class="form-input" 
                        placeholder="Enter custom size (max 1300mm)"
                        min="1"
                        max="1300"
                        onchange="setCustomSize(${i})"
                    >
                </div>
            </div>
        `;
        container.appendChild(rollDiv);

        // Initialize roll object
        rolls[i] = {
            rollNumber: i + 1,
            size: null,
            isCustom: false
        };
    }
}

function selectSize(rollIndex, size, element) {
    // Remove selected class from all options in this roll
    const rollDiv = document.getElementById(`roll-${rollIndex}`);
    const options = rollDiv.querySelectorAll('.size-option');
    options.forEach(opt => opt.classList.remove('selected'));

    // Add selected class to clicked option
    if (element) {
        element.classList.add('selected');
    }

    // Hide custom input if it was shown
    document.getElementById(`custom-input-${rollIndex}`).style.display = 'none';

    // Set the size
    rolls[rollIndex].size = size;
    rolls[rollIndex].isCustom = false;

    // Clear custom input
    document.getElementById(`custom-size-${rollIndex}`).value = '';

    // Validate total
    validateTotal();
}

function selectCustom(rollIndex, element) {
    // Remove selected class from all options
    const rollDiv = document.getElementById(`roll-${rollIndex}`);
    const options = rollDiv.querySelectorAll('.size-option');
    options.forEach(opt => opt.classList.remove('selected'));
    
    // Optionally highlight the Custom option
    if (element) {
        element.classList.add('selected');
    }

    // Show custom input
    document.getElementById(`custom-input-${rollIndex}`).style.display = 'block';
    document.getElementById(`custom-size-${rollIndex}`).focus();

    rolls[rollIndex].isCustom = true;
}

function setCustomSize(rollIndex) {
    const input = document.getElementById(`custom-size-${rollIndex}`);
    const size = parseInt(input.value);

    if (size && size > 0 && size <= 1300) {
        rolls[rollIndex].size = size;
        validateTotal();
    } else if (size > 1300) {
        alert('Custom size cannot exceed 1300mm');
        input.value = '';
        rolls[rollIndex].size = null;
        validateTotal();
    } else {
        rolls[rollIndex].size = null;
        validateTotal();
    }
}

function validateTotal() {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = '';

    const total = rolls.reduce((sum, roll) => {
        return sum + (roll.size || 0);
    }, 0);

    if (total > MAX_TOTAL_SIZE) {
        const rollsList = rolls.map((roll, index) => {
            if (roll.size) {
                return `
                    <li>
                        <span>Roll ${roll.rollNumber}: ${roll.size}mm</span>
                        <button class="btn btn-small btn-secondary" onclick="editRoll(${index})">Edit</button>
                    </li>
                `;
            }
            return '';
        }).filter(item => item).join('');

        errorContainer.innerHTML = `
            <div class="error-message">
                <div class="error-title">
                    ⚠️ Measurements Exceed Limit
                </div>
                <p>Total measurements exceed the limit of ${MAX_TOTAL_SIZE}mm film.</p>
                <div class="error-details">
                    <div class="error-total">You have entered: <strong>${total}mm</strong></div>
                    <div>Rolls entered:</div>
                    <ul class="rolls-list">
                        ${rollsList}
                    </ul>
                </div>
            </div>
        `;

        errorContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return false;
    }

    return true;
}

function editRoll(rollIndex) {
    const rollDiv = document.getElementById(`roll-${rollIndex}`);
    rollDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Clear the roll's size
    rolls[rollIndex].size = null;
    rolls[rollIndex].isCustom = false;

    // Clear all selections
    const options = rollDiv.querySelectorAll('.size-option');
    options.forEach(opt => opt.classList.remove('selected'));

    // Hide custom input
    document.getElementById(`custom-input-${rollIndex}`).style.display = 'none';
    document.getElementById(`custom-size-${rollIndex}`).value = '';

    // Clear error message
    validateTotal();
}

function goBackToJobNumber() {
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step0').style.display = 'block';
    jobNumber = null;
}

function goBackToStep1() {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('errorContainer').innerHTML = '';
    rolls = [];
    numberOfRolls = 0;
}

async function submitJobAssignment() {
    // Prevent double submission
    if (isSubmitting) {
        console.log('Submission already in progress, ignoring duplicate call');
        return;
    }

    // Validate all rolls have sizes
    const incompleteRolls = rolls.filter(roll => !roll.size);
    if (incompleteRolls.length > 0) {
        alert(`Please enter sizes for all ${numberOfRolls} rolls`);
        return;
    }

    // Validate total
    if (!validateTotal()) {
        return;
    }

    // Validate job number
    if (!jobNumber) {
        alert('Job number is required. Please go back and enter a job number.');
        return;
    }

    // Get lot and stock numbers (from QR code or manual entry)
    const lotNumber = document.getElementById('lotNumber').value.trim();
    const stockNumber = document.getElementById('stockNumber').value.trim();
    
    if (!lotNumber || !stockNumber) {
        alert('Both lot number and stock number are required.');
        return;
    }
    
    // If no QR value, construct it from lot-stock format
    let finalQRValue = qrValue;
    if (!finalQRValue) {
        finalQRValue = `${lotNumber}-${stockNumber}`;
    }

    // Set submitting flag and disable button
    isSubmitting = true;
    const submitButton = document.querySelector('button[onclick="submitJobAssignment()"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Submitting...';
    }
    
    try {
        // Check if child rolls already exist for this master roll
        const existingChildRolls = await DB.childRolls.getByMasterQR(finalQRValue);
        if (existingChildRolls.length > 0) {
            console.warn('Child rolls already exist for this master roll:', existingChildRolls.length);
            isSubmitting = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Job Assignment';
            }
            alert(`This master roll has already been slit with ${existingChildRolls.length} child rolls. Redirecting to roll selection...`);
            navigateTo(`select-roll.html?qr=${encodeURIComponent(finalQRValue)}`);
            return;
        }

        // Verify master roll exists
        if (!masterRoll) {
            masterRoll = await DB.masterRolls.getByQR(finalQRValue);
            if (!masterRoll) {
                // Check if QR code exists - if so, auto-create master roll
                const qrCode = await DB.qrCodes.getByValue(finalQRValue);
                if (qrCode) {
                    // Auto-create master roll from QR code
                    masterRoll = await DB.masterRolls.create({
                        qrValue: finalQRValue,
                        stockNumber: qrCode.stockNumber,
                        lotNumber: qrCode.lotNumber
                    });
                } else {
                    // Manual entry - create QR code and master roll if they don't exist
                    // First, create QR code record
                    const newQRCode = await DB.qrCodes.create({
                        qrValue: finalQRValue,
                        stockNumber: stockNumber,
                        lotNumber: lotNumber
                    });
                    
                    // Then create master roll
                    masterRoll = await DB.masterRolls.create({
                        qrValue: finalQRValue,
                        stockNumber: stockNumber,
                        lotNumber: lotNumber
                    });
                    
                    console.log('Created QR code and master roll from manual entry:', {
                        qrCode: newQRCode,
                        masterRoll: masterRoll
                    });
                }
            }
        }

        // Extract widths from rolls
        const widths = rolls.map(roll => roll.size);
        
        // Validate we have the correct number of widths
        if (widths.length !== numberOfRolls) {
            console.error('Width count mismatch:', {
                expected: numberOfRolls,
                actual: widths.length,
                rolls: rolls
            });
            isSubmitting = false;
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Job Assignment';
            }
            alert(`Error: Expected ${numberOfRolls} roll sizes but found ${widths.length}. Please try again.`);
            return;
        }

        // Use the entered job number as job ID
        const jobId = jobNumber || `job-${Date.now()}`;

        console.log('Creating child rolls:', {
            masterRollQR: finalQRValue,
            widths: widths,
            count: widths.length,
            jobId: jobId
        });

        // Create child rolls (Stage 2) with job ID
        await DB.childRolls.createBatch(finalQRValue, widths, jobId);

        // Mark master roll as slit
        await DB.masterRolls.markAsSlit(finalQRValue);

        // Log scan event
        await DB.scanEvents.create({
            qrValue: finalQRValue,
            action: 'slitting',
            childRollId: null
        });
        
        // Debug: Log what was created and verify
        console.log('Job Assignment - Saving data...', {
            qrValue: finalQRValue,
            widths: widths,
            numberOfRolls: widths.length
        });
        
        // Verify data was actually saved
        const verifyMasterRoll = await DB.masterRolls.getByQR(finalQRValue);
        const verifyChildRolls = await DB.childRolls.getByMasterQR(finalQRValue);
        
        console.log('Job Assignment - Verification:', {
            masterRoll: verifyMasterRoll,
            childRollsCount: verifyChildRolls.length,
            expectedCount: widths.length,
            childRolls: verifyChildRolls
        });
        
        if (!verifyMasterRoll) {
            console.error('ERROR: Master roll was not saved!');
            alert('ERROR: Failed to save master roll. Check console for details.');
            return;
        }
        
        if (verifyMasterRoll.status !== 'slit') {
            console.error('ERROR: Master roll status was not updated to "slit"!');
            alert('ERROR: Master roll status update failed. Check console for details.');
            return;
        }
        
        if (verifyChildRolls.length !== widths.length) {
            console.error('ERROR: Child rolls count mismatch!', {
                expected: widths.length,
                actual: verifyChildRolls.length
            });
            alert(`ERROR: Only ${verifyChildRolls.length} of ${widths.length} child rolls were saved. Check console for details.`);
            return;
        }
        
        console.log('✓ Verification passed - All data saved successfully');

        // Show success message with verification
        const totalSize = widths.reduce((sum, width) => sum + width, 0);
        document.getElementById('successDetails').innerHTML = `
            <p><strong>Job Number:</strong> ${jobNumber}</p>
            <p><strong>Master Roll:</strong> ${finalQRValue}</p>
            <p><strong>Stock Number:</strong> ${verifyMasterRoll.stockNumber}</p>
            <p><strong>Lot Number:</strong> ${verifyMasterRoll.lotNumber}</p>
            <p><strong>Number of Rolls Created:</strong> ${numberOfRolls}</p>
            <p><strong>Total Size:</strong> ${totalSize}mm</p>
            <p><strong>Remaining:</strong> ${MAX_TOTAL_SIZE - totalSize}mm</p>
            <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(16, 185, 129, 0.3);">
                <strong>Status:</strong> Master roll is now slit. Child rolls are available for use.
            </p>
            <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">
                ✓ Data saved to database. You can view this in Inventory.
            </p>
            <p style="margin-top: 8px; font-size: 0.9rem; color: var(--success-green); font-weight: 600;">
                ✓ Verified: ${verifyChildRolls.length} child rolls saved | Master roll status: ${verifyMasterRoll.status}
            </p>
        `;

        document.getElementById('step2').style.display = 'none';
        document.getElementById('step3').style.display = 'block';
        
        // Log final state for debugging
        const snapshot = await DB.getSnapshot();
        console.log('Final database state:', snapshot);
        
        // Reset submitting flag on success
        isSubmitting = false;
    } catch (error) {
        console.error('Error submitting job assignment:', error);
        isSubmitting = false; // Reset flag on error
        const submitButton = document.querySelector('button[onclick="submitJobAssignment()"]');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Job Assignment';
        }
        alert('ERROR: Failed to save job assignment. ' + error.message);
    }
}

function createNewAssignment() {
    // Reset everything
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step0').style.display = 'block';
    document.getElementById('jobNumber').value = '';
    document.getElementById('numberOfRolls').value = '';
    rolls = [];
    numberOfRolls = 0;
    currentRollIndex = 0;
    jobNumber = null;
}

