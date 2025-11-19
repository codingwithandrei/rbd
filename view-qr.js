// QR Code View functionality - Now routes to appropriate stage
document.addEventListener('DOMContentLoaded', function() {
    const displayContainer = document.getElementById('qrInfoDisplay');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const lotNumber = urlParams.get('lot');
    const stockNumber = urlParams.get('stock');
    const qrValue = urlParams.get('qr');

    // Construct QR value
    const finalQRValue = qrValue || (lotNumber && stockNumber ? `${lotNumber}-${stockNumber}` : null);

    if (finalQRValue) {
        // Determine stage and redirect
        const stage = DB.getQRStage(finalQRValue);
        
        if (stage === 'stage1') {
            // Redirect to Master Roll Registration
            window.location.href = `master-roll.html?qr=${encodeURIComponent(finalQRValue)}&lot=${encodeURIComponent(lotNumber || '')}&stock=${encodeURIComponent(stockNumber || '')}`;
            return;
        } else if (stage === 'stage2') {
            // Redirect to Job Assignment
            window.location.href = `job-assignment.html?qr=${encodeURIComponent(finalQRValue)}`;
            return;
        } else if (stage === 'stage3') {
            // Redirect to Select Roll
            window.location.href = `select-roll.html?qr=${encodeURIComponent(finalQRValue)}`;
            return;
        } else if (stage === 'all_used') {
            // Show all used message
            displayContainer.innerHTML = `
                <div class="error-message">
                    <h3 style="margin-bottom: 12px;">All Rolls Used</h3>
                    <p>All rolls from this master roll have already been used.</p>
                    <p style="margin-top: 12px;"><strong>QR Code:</strong> ${finalQRValue}</p>
                </div>
            `;
            return;
        }
    }

    // Fallback: Show QR code information
    if (lotNumber && stockNumber) {
        displayContainer.innerHTML = `
            <div class="success-message">
                <h3 style="margin-bottom: 20px; color: var(--primary-blue);">QR Code Information</h3>
                <div style="background: var(--white); padding: 24px; border-radius: 8px; margin-top: 16px;">
                    <div class="form-group" style="margin-bottom: 20px;">
                        <label class="form-label">Lot Number</label>
                        <div style="font-size: 1.2rem; font-weight: 600; color: var(--gray-800); padding: 12px; background: var(--gray-50); border-radius: 8px;">
                            ${lotNumber}
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Stock Number</label>
                        <div style="font-size: 1.2rem; font-weight: 600; color: var(--gray-800); padding: 12px; background: var(--gray-50); border-radius: 8px;">
                            ${stockNumber}
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else {
        displayContainer.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">Invalid QR Code</h3>
                <p>No valid lot number or stock number found in the scanned QR code.</p>
            </div>
        `;
    }
});

