// QR Code Generation functionality
let numberOfQRCodes = 0;
let qrDataArray = [];
let generatedQRCodes = [];

function proceedToQRData() {
    const input = document.getElementById('numberOfQRCodes');
    const value = parseInt(input.value);

    if (!value || value < 1) {
        alert('Please enter a valid number of QR codes (minimum 1)');
        return;
    }

    numberOfQRCodes = value;
    qrDataArray = [];

    // Hide step 1, show step 2
    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';

    // Generate input forms for each QR code
    generateQRDataInputs();
}

function generateQRDataInputs() {
    const container = document.getElementById('qrDataContainer');
    container.innerHTML = '';

    for (let i = 0; i < numberOfQRCodes; i++) {
        const qrDiv = document.createElement('div');
        qrDiv.className = 'qr-data-entry';
        qrDiv.style.marginBottom = '24px';
        qrDiv.style.padding = '20px';
        qrDiv.style.background = 'var(--gray-50)';
        qrDiv.style.borderRadius = '8px';
        qrDiv.style.border = '2px solid var(--gray-200)';
        qrDiv.innerHTML = `
            <h4 style="color: var(--primary-blue); margin-bottom: 16px; font-size: 1.1rem;">QR Code ${i + 1}</h4>
            <div class="form-group">
                <label for="lotNumber-${i}" class="form-label">Lot Number</label>
                <input 
                    type="text" 
                    id="lotNumber-${i}" 
                    class="form-input" 
                    placeholder="Enter lot number"
                    required
                >
            </div>
            <div class="form-group">
                <label for="stockNumber-${i}" class="form-label">Stock Number</label>
                <input 
                    type="text" 
                    id="stockNumber-${i}" 
                    class="form-input" 
                    placeholder="Enter stock number"
                    required
                >
            </div>
        `;
        container.appendChild(qrDiv);
        
        // Add event listeners to clear error highlighting when user edits
        const lotInput = document.getElementById(`lotNumber-${i}`);
        const stockInput = document.getElementById(`stockNumber-${i}`);
        
        lotInput.addEventListener('input', () => {
            lotInput.style.borderColor = '';
            stockInput.style.borderColor = '';
        });
        
        stockInput.addEventListener('input', () => {
            lotInput.style.borderColor = '';
            stockInput.style.borderColor = '';
        });

        // Initialize QR data object
        qrDataArray[i] = {
            id: Date.now() + i,
            lotNumber: '',
            stockNumber: ''
        };
    }
}

function goBackToStep1() {
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    qrDataArray = [];
    numberOfQRCodes = 0;
}

async function generateQRCodes() {
    // Generate a unique batch ID for this generation session
    // All QR codes created in this session will share the same batchId
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Collect all data
    const allValid = true;
    const seenCombinations = new Set(); // Track lot-stock combinations to detect duplicates
    
    for (let i = 0; i < numberOfQRCodes; i++) {
        const lotNumber = document.getElementById(`lotNumber-${i}`).value.trim();
        const stockNumber = document.getElementById(`stockNumber-${i}`).value.trim();

        if (!lotNumber || !stockNumber) {
            alert(`Please fill in both lot number and stock number for QR Code ${i + 1}`);
            return;
        }

        // Check for duplicate lot-stock combination
        const combination = `${lotNumber}-${stockNumber}`;
        if (seenCombinations.has(combination)) {
            alert(`ERROR: Duplicate lot/stock combination detected!\n\nQR Code ${i + 1} has the same Lot Number (${lotNumber}) and Stock Number (${stockNumber}) as a previous entry.\n\nPlease correct the duplicate before proceeding.`);
            // Highlight the duplicate field
            document.getElementById(`lotNumber-${i}`).style.borderColor = 'var(--error-red)';
            document.getElementById(`stockNumber-${i}`).style.borderColor = 'var(--error-red)';
            return; // Stop and prevent proceeding
        }
        
        seenCombinations.add(combination);
        qrDataArray[i].lotNumber = lotNumber;
        qrDataArray[i].stockNumber = stockNumber;
    }

    // Generate QR codes
    generatedQRCodes = [];
    const displayContainer = document.getElementById('qrCodesDisplay');
    displayContainer.innerHTML = '';

    qrDataArray.forEach((data, index) => {
        // Create QR value (lot-stock format)
        const qrValue = `${data.lotNumber}-${data.stockNumber}`;
        
        // Get base URL - use production domain for QR codes
        // IMPORTANT: Update this to your actual Vercel deployment URL
        const productionUrl = 'https://rbd-weld.vercel.app'; // Change this to your actual domain
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1' || 
                           window.location.hostname.includes('192.168.');
        
        // Use production URL for QR codes (so they always work when scanned)
        // Only use localhost if actually running locally
        const baseUrl = isLocalhost ? window.location.origin : productionUrl;
        
        // Create QR code data - always use full URL so it works when scanned from phone
        const qrData = `${baseUrl}/index.html?qr=${encodeURIComponent(qrValue)}&lot=${encodeURIComponent(data.lotNumber)}&stock=${encodeURIComponent(data.stockNumber)}`;
        
        // Also create a JSON version for direct scanning (shows data in QR reader)
        const qrDataJSON = JSON.stringify({
            lotNumber: data.lotNumber,
            stockNumber: data.stockNumber,
            timestamp: new Date().toISOString()
        });

        // Create QR code container
        const qrCard = document.createElement('div');
        qrCard.className = 'qr-code-card';
        qrCard.innerHTML = `
            <div class="qr-code-info">
                <h4>QR Code ${index + 1}</h4>
                <p><strong>Lot:</strong> ${data.lotNumber}</p>
                <p><strong>Stock:</strong> ${data.stockNumber}</p>
                <p style="font-size: 0.85rem; color: var(--gray-600); margin-top: 8px;">
                    <strong>Data:</strong> When scanned, displays lot and stock numbers
                </p>
            </div>
            <div id="qrcode-${index}" class="qrcode-container"></div>
        `;
        displayContainer.appendChild(qrCard);

        // Generate QR code using QRCode.js library
        const qrElement = document.getElementById(`qrcode-${index}`);
        
        // Clear any existing content
        qrElement.innerHTML = '';
        
        // Create QR code with URL (will open page when scanned)
        // Also include JSON data as fallback for direct scanning
        try {
            new QRCode(qrElement, {
                text: qrData, // URL format for web scanning
                width: 200,
                height: 200,
                colorDark: '#1f2937',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error('QR Code generation error:', error);
            qrElement.innerHTML = '<p style="color: var(--error-red);">Error generating QR code</p>';
        }

        generatedQRCodes.push({
            ...data,
            qrValue: qrValue,
            qrData: qrData,
            qrDataJSON: qrDataJSON,
            element: qrElement,
            batchId: batchId  // All QR codes in this session share the same batchId
        });
    });

        // Save to database with verification
        console.log('Saving QR codes to database...', generatedQRCodes);
        console.log('Batch ID for this generation:', batchId);
        try {
            for (const qr of generatedQRCodes) {
                // Create QR code record in database (if not already exists)
                const existing = await DB.qrCodes.getByValue(qr.qrValue);
                if (!existing) {
                    try {
                        const saved = await DB.qrCodes.create({
                            qrValue: qr.qrValue,
                            lotNumber: qr.lotNumber,
                            stockNumber: qr.stockNumber,
                            qrUrl: qr.qrData,  // Save the full URL for printing
                            batchId: batchId   // Store batch ID for grouping
                        });
                        
                        // Verify it was saved
                        const verify = await DB.qrCodes.getByValue(qr.qrValue);
                        if (!verify) {
                            console.error(`ERROR: QR code ${qr.qrValue} was not saved!`);
                            alert(`ERROR: Failed to save QR code ${qr.qrValue}. Check console.`);
                        } else {
                            console.log(`✓ QR code ${qr.qrValue} saved and verified`);
                        }
                    } catch (error) {
                        console.error(`Error saving QR code ${qr.qrValue}:`, error);
                        alert(`ERROR: Failed to save QR code ${qr.qrValue}. Check console.`);
                    }
                } else {
                    console.log(`QR code ${qr.qrValue} already exists, skipping`);
                }
            }
            
            // Final verification
            const allQRCodes = await DB.qrCodes.getAll();
            console.log(`Total QR codes in database: ${allQRCodes.length}`);
            console.log('All QR codes:', allQRCodes);
        } catch (error) {
            console.error('Error saving QR codes:', error);
            alert('ERROR: Failed to save QR codes to database. Check console.');
        }

    // Show step 3
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'block';
}

function createNewQRCodes() {
    // Reset everything
    document.getElementById('step3').style.display = 'none';
    document.getElementById('step1').style.display = 'block';
    document.getElementById('numberOfQRCodes').value = '';
    qrDataArray = [];
    numberOfQRCodes = 0;
    generatedQRCodes = [];
}

function printQRCodes() {
    window.print();
}

