// Job Assignment functionality - Stage 2
let numberOfRolls = 0;
let rolls = [];
let currentRollIndex = 0;
let qrValue = null; // Store QR value from URL

const PRESET_SIZES = [225, 241, 325];
const MAX_TOTAL_SIZE = 1300;

// Initialize: Get QR value and verify master roll
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    qrValue = urlParams.get('qr');

    if (qrValue) {
        // Verify master roll exists and is in correct stage
        const masterRoll = DB.masterRolls.getByQR(qrValue);
        
        if (!masterRoll) {
            // Show warning but allow manual entry for testing
            const messageContainer = document.createElement('div');
            messageContainer.id = 'qrWarningContainer';
            messageContainer.style.marginBottom = '20px';
            messageContainer.innerHTML = `
                <div class="error-message" style="margin-bottom: 0;">
                    <p><strong>Warning:</strong> Master roll not found for QR: ${qrValue}</p>
                    <p style="margin-top: 8px; font-size: 0.9rem;">You can still proceed manually, but the master roll will need to be registered first.</p>
                </div>
            `;
            document.querySelector('.form-container').insertBefore(messageContainer, document.querySelector('#step1'));
        } else {
            if (masterRoll.status !== 'registered') {
                // Check if already slit
                const childRolls = DB.childRolls.getByMasterQR(qrValue);
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
        // No QR code - allow manual entry (for testing)
        const header = document.querySelector('.header .subtitle');
        if (header) {
            header.innerHTML = `Split master roll into production rolls<br><small style="font-size: 0.85rem; color: var(--gray-600);">Manual Entry Mode (for testing)</small>`;
        }
    }
});

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

function goBackToStep1() {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('errorContainer').innerHTML = '';
    rolls = [];
    numberOfRolls = 0;
}

function submitJobAssignment() {
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

    // Get QR value (use from URL or allow manual creation for testing)
    let finalQRValue = qrValue;
    let masterRoll = null;
    
    // If no QR value, allow manual entry for testing
    if (!finalQRValue) {
        const stockNumber = prompt('Enter Stock Number (for testing):');
        const lotNumber = prompt('Enter Lot Number (for testing):');
        
        if (!stockNumber || !lotNumber) {
            alert('Stock and Lot numbers are required for manual entry.');
            return;
        }
        
        // Normalize the values (trim whitespace)
        const normalizedStock = stockNumber.trim();
        const normalizedLot = lotNumber.trim();
        finalQRValue = `${normalizedLot}-${normalizedStock}`;
        
        // First, check if a QR code exists with matching stock/lot (might be in different order)
        const existingQR = DB.qrCodes.getAll().find(qr => 
            (qr.stockNumber === normalizedStock && qr.lotNumber === normalizedLot) ||
            (qr.stockNumber === normalizedLot && qr.lotNumber === normalizedStock) // Handle reverse
        );
        
        // Use existing QR value if found, otherwise use the format we created
        if (existingQR) {
            finalQRValue = existingQR.qrValue;
        }
        
        // Check if master roll exists, if not create it for testing
        masterRoll = DB.masterRolls.getByQR(finalQRValue);
        if (!masterRoll) {
            // Create master roll for testing
            masterRoll = DB.masterRolls.create({
                qrValue: finalQRValue,
                stockNumber: normalizedStock,
                lotNumber: normalizedLot
            });
            
            // Also create QR code record if it doesn't exist
            if (!DB.qrCodes.getByValue(finalQRValue) && !existingQR) {
                DB.qrCodes.create({
                    qrValue: finalQRValue,
                    lotNumber: normalizedLot,
                    stockNumber: normalizedStock
                });
            }
        }
    } else {
        // Verify master roll exists
        masterRoll = DB.masterRolls.getByQR(finalQRValue);
        if (!masterRoll) {
            // Check if QR code exists - if so, auto-create master roll
            const qrCode = DB.qrCodes.getByValue(finalQRValue);
            if (qrCode) {
                // Auto-create master roll from QR code
                masterRoll = DB.masterRolls.create({
                    qrValue: finalQRValue,
                    stockNumber: qrCode.stockNumber,
                    lotNumber: qrCode.lotNumber
                });
            } else {
                alert('Master roll not found. Please register the master roll first.');
                return;
            }
        }
    }

    // Extract widths from rolls
    const widths = rolls.map(roll => roll.size);

    // Create job ID for this slitting operation
    const jobId = `job-${Date.now()}`;

    // Create child rolls (Stage 2) with job ID
    const childRolls = DB.childRolls.createBatch(finalQRValue, widths, jobId);

    // Mark master roll as slit
    DB.masterRolls.markAsSlit(finalQRValue);

    // Log scan event
    DB.scanEvents.create({
        qrValue: finalQRValue,
        action: 'slitting',
        childRollId: null
    });
    
    // Debug: Log what was created
    console.log('Job Assignment completed:', {
        qrValue: finalQRValue,
        masterRoll: DB.masterRolls.getByQR(finalQRValue),
        childRolls: DB.childRolls.getByMasterQR(finalQRValue)
    });

    // Show success message
    const totalSize = widths.reduce((sum, width) => sum + width, 0);
    const updatedMasterRoll = DB.masterRolls.getByQR(finalQRValue);
    document.getElementById('successDetails').innerHTML = `
        <p><strong>Master Roll:</strong> ${finalQRValue}</p>
        <p><strong>Stock Number:</strong> ${updatedMasterRoll.stockNumber}</p>
        <p><strong>Lot Number:</strong> ${updatedMasterRoll.lotNumber}</p>
        <p><strong>Number of Rolls Created:</strong> ${numberOfRolls}</p>
        <p><strong>Total Size:</strong> ${totalSize}mm</p>
        <p><strong>Remaining:</strong> ${MAX_TOTAL_SIZE - totalSize}mm</p>
        <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(16, 185, 129, 0.3);">
            <strong>Status:</strong> Master roll is now slit. Child rolls are available for use.
        </p>
        <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">
            ✓ Data saved to database. You can view this in Inventory.
        </p>
    `;

    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
}

function createNewAssignment() {
    // Reset everything
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('numberOfRolls').value = '';
    rolls = [];
    numberOfRolls = 0;
    currentRollIndex = 0;
}

