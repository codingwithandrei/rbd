// Master Roll Registration functionality - Stage 1
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('masterRollForm');
    const messageContainer = document.getElementById('messageContainer');

    // Get QR code parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const qrValue = urlParams.get('qr');
    const lotParam = urlParams.get('lot');
    const stockParam = urlParams.get('stock');

    // Pre-fill form if QR code data is available
    if (qrValue) {
        // Check if QR code exists in database
        const qrCode = DB.qrCodes.getByValue(qrValue);
        if (qrCode) {
            document.getElementById('lotNumber').value = qrCode.lotNumber || lotParam || '';
            document.getElementById('stockNumber').value = qrCode.stockNumber || stockParam || '';
        } else if (lotParam && stockParam) {
            document.getElementById('lotNumber').value = lotParam;
            document.getElementById('stockNumber').value = stockParam;
        }

        // Show QR code info
        const qrInfo = document.createElement('div');
        qrInfo.className = 'success-message';
        qrInfo.style.marginBottom = '20px';
        qrInfo.innerHTML = `
            <p><strong>QR Code Verified:</strong> ${qrValue}</p>
            <p style="font-size: 0.9rem; margin-top: 8px;">QR code found in database. Please confirm and mark this master roll as received.</p>
        `;
        messageContainer.appendChild(qrInfo);
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const stockNumber = document.getElementById('stockNumber').value.trim();
        const lotNumber = document.getElementById('lotNumber').value.trim();

        if (!stockNumber || !lotNumber) {
            showMessage('Please fill in all fields', 'error');
            return;
        }

        // Determine QR value
        const finalQRValue = qrValue || `${lotNumber}-${stockNumber}`;

        // VALIDATION: Master roll cannot be marked as received without a QR code in database
        if (!qrValue) {
            // No QR code in URL - check if QR code exists in database for this lot/stock
            const qrCodeInDB = DB.qrCodes.getByValue(finalQRValue);
            if (!qrCodeInDB) {
                showMessage('ERROR: Cannot mark master roll as received. QR code must be generated first using "Generate QR Codes".', 'error');
                return;
            }
        } else {
            // QR code in URL - verify it exists in database
            const qrCodeInDB = DB.qrCodes.getByValue(qrValue);
            if (!qrCodeInDB) {
                showMessage('ERROR: QR code not found in database. Please generate this QR code first using "Generate QR Codes".', 'error');
                return;
            }
        }

        // Check if master roll already exists
        const existingRoll = DB.masterRolls.getByQR(finalQRValue);
        if (existingRoll) {
            showMessage('This master roll is already registered!', 'error');
            setTimeout(() => {
                // Redirect based on stage
                const stage = DB.getQRStage(finalQRValue);
                if (stage === 'stage2') {
                    navigateTo(`job-assignment.html?qr=${encodeURIComponent(finalQRValue)}`);
                } else if (stage === 'stage3') {
                    navigateTo(`select-roll.html?qr=${encodeURIComponent(finalQRValue)}`);
                } else {
                    navigateTo('index.html');
                }
            }, 2000);
            return;
        }

        // Create master roll record (Stage 1) - Mark as "received"
        const newMasterRoll = DB.masterRolls.create({
            qrValue: finalQRValue,
            stockNumber: stockNumber,
            lotNumber: lotNumber
        });

        // Ensure QR code record exists (should already exist from generation, but double-check)
        if (!DB.qrCodes.getByValue(finalQRValue)) {
            DB.qrCodes.create({
                qrValue: finalQRValue,
                lotNumber: lotNumber,
                stockNumber: stockNumber
            });
        }

        // Log scan event
        DB.scanEvents.create({
            qrValue: finalQRValue,
            action: 'registration'
        });

        // Verify the master roll was saved
        const verifyRoll = DB.masterRolls.getByQR(finalQRValue);
        if (!verifyRoll) {
            console.error('ERROR: Master roll was not saved!');
            showMessage('ERROR: Failed to save master roll. Please try again.', 'error');
            return;
        }

        console.log('✓ Master roll saved and verified:', verifyRoll);
        showMessage('Master roll marked as received successfully! Status: Received (ready for slitting)', 'success');
        
        // Clear form
        form.reset();

        // Redirect to home after delay
        setTimeout(() => {
            navigateTo('index.html');
        }, 2000);
    });

    function showMessage(message, type) {
        const existingMsg = messageContainer.querySelector('.error-message, .success-message');
        if (existingMsg && !existingMsg.innerHTML.includes('QR Code Scanned')) {
            existingMsg.remove();
        }
        
        const msgDiv = document.createElement('div');
        msgDiv.className = type === 'error' ? 'error-message' : 'success-message';
        msgDiv.innerHTML = message;
        messageContainer.appendChild(msgDiv);
        
        // Scroll to message
        msgDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});

