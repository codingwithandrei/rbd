// QR Code Generation functionality
let numberOfQRCodes = 0;
let qrDataArray = [];
let generatedQRCodes = [];

// Show generate form (manual entry)
function showGenerateForm() {
    // Hide selection cards
    const selectionCards = document.getElementById('selectionCards');
    if (selectionCards) {
        selectionCards.style.display = 'none';
    }
    // Show generate form
    document.getElementById('generateForm').style.display = 'block';
    document.getElementById('csvUploadForm').style.display = 'none';
}

// Show CSV upload form
function showCSVUpload() {
    // Hide selection cards
    const selectionCards = document.getElementById('selectionCards');
    if (selectionCards) {
        selectionCards.style.display = 'none';
    }
    // Show CSV upload form
    document.getElementById('generateForm').style.display = 'none';
    document.getElementById('csvUploadForm').style.display = 'block';
}

// Go back to step 1 (selection screen)
function goBackToStep1() {
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
    document.getElementById('step3').style.display = 'none';
    document.getElementById('generateForm').style.display = 'none';
    document.getElementById('csvUploadForm').style.display = 'none';
    // Show selection cards again
    const selectionCards = document.getElementById('selectionCards');
    if (selectionCards) {
        selectionCards.style.display = 'grid';
    }
    qrDataArray = [];
    numberOfQRCodes = 0;
}

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

// CSV Import functionality (moved from view-qr-codes.js)
async function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // Reset file input for future selections
    event.target.value = '';
    
    try {
        // Show loading message
        const loadingMessage = document.createElement('div');
        loadingMessage.id = 'csvLoadingMessage';
        loadingMessage.className = 'info-message';
        loadingMessage.innerHTML = '<p>Importing QR codes from CSV...</p>';
        loadingMessage.style.display = 'block';
        const csvUploadForm = document.getElementById('csvUploadForm');
        csvUploadForm.insertBefore(loadingMessage, csvUploadForm.firstChild);
        
        // Read file as text
        const text = await file.text();
        
        // Parse CSV
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error('CSV file must contain at least a header row and one data row');
        }
        
        // Parse header row
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        
        // Find column indices (case-insensitive, flexible matching)
        const stockIndex = headers.findIndex(h => 
            h.includes('stock') && h.includes('number'));
        const lotIndex = headers.findIndex(h => 
            h.includes('lot') && h.includes('number'));
        const urlIndex = headers.findIndex(h => 
            h.includes('url') || h.includes('qr url'));
        
        if (stockIndex === -1 || lotIndex === -1) {
            throw new Error('CSV must contain "Stock Number" and "Lot Number" columns');
        }
        
        // Parse data rows
        const qrCodesToImport = [];
        const errors = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue; // Skip empty lines
            
            // Parse CSV line (handles quoted values)
            const values = parseCSVLine(line);
            
            const stock = values[stockIndex]?.trim().replace(/^"|"$/g, '');
            const lot = values[lotIndex]?.trim().replace(/^"|"$/g, '');
            const url = urlIndex !== -1 ? values[urlIndex]?.trim().replace(/^"|"$/g, '') : null;
            
            if (!stock || !lot) {
                errors.push(`Row ${i + 1}: Missing stock or lot number`);
                continue;
            }
            
            qrCodesToImport.push({
                stockNumber: stock,
                lotNumber: lot,
                qrUrl: url || null
            });
        }
        
        if (qrCodesToImport.length === 0) {
            throw new Error('No valid QR codes found in CSV file');
        }
        
        // Import to database
        const result = await importQRCodesToDatabase(qrCodesToImport);
        
        // Hide loading message
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
            loadingMessage.remove();
        }
        
        // Show results
        let message = `✓ Import complete!\n\n`;
        message += `Successfully imported: ${result.success}\n`;
        if (result.skipped > 0) {
            message += `Already existed (skipped): ${result.skipped}\n`;
        }
        if (result.errors > 0) {
            message += `Errors: ${result.errors}\n`;
        }
        if (errors.length > 0) {
            message += `\nRow errors: ${errors.length}`;
        }
        
        alert(message);
        
        // Navigate to view QR codes page to see the imported codes
        navigateTo('view-qr-codes.html');
        
    } catch (error) {
        console.error('Error importing CSV:', error);
        const loadingMessage = document.getElementById('csvLoadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
            loadingMessage.remove();
        }
        alert(`✗ Failed to import CSV.\n\nError: ${error.message}\n\nPlease check the CSV format and try again.`);
    }
}

// Helper function to parse CSV line (handles quoted values with commas)
function parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of value
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // Add last value
    values.push(current);
    
    return values;
}

// Import QR codes to database (no overwriting - only adds new ones)
async function importQRCodesToDatabase(qrCodes) {
    let success = 0;
    let skipped = 0;
    let errors = 0;
    
    // Generate a unique batch ID for this CSV import session
    // All QR codes imported in this session will share the same batchId
    const batchId = `batch-import-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('Batch ID for CSV import:', batchId);
    
    // Get production URL for QR code generation
    const productionUrl = 'https://rbd-weld.vercel.app';
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' || 
                       window.location.hostname.includes('192.168.');
    const baseUrl = isLocalhost ? window.location.origin : productionUrl;
    
    for (const qr of qrCodes) {
        try {
            const qrValue = `${qr.lotNumber}-${qr.stockNumber}`;
            
            // Check if already exists - NO OVERWRITING, skip if exists
            const existing = await DB.qrCodes.getByValue(qrValue);
            if (existing) {
                console.log(`QR code ${qrValue} already exists, skipping (no overwrite)`);
                skipped++;
                continue;
            }
            
            // Generate QR URL if not provided (same as manual generation)
            let qrUrl = qr.qrUrl;
            if (!qrUrl) {
                qrUrl = `${baseUrl}/index.html?qr=${encodeURIComponent(qrValue)}&lot=${encodeURIComponent(qr.lotNumber)}&stock=${encodeURIComponent(qr.stockNumber)}`;
            }
            
            // Create QR code in database (same as manual generation, with batchId)
            await DB.qrCodes.create({
                qrValue: qrValue,
                lotNumber: qr.lotNumber,
                stockNumber: qr.stockNumber,
                qrUrl: qrUrl,
                batchId: batchId  // All imported QR codes share the same batchId
            });
            
            success++;
            console.log(`✓ Imported QR code: ${qrValue}`);
            
        } catch (error) {
            console.error(`Error importing ${qr.stockNumber}/${qr.lotNumber}:`, error);
            errors++;
        }
    }
    
    return {
        success: success,
        skipped: skipped,
        errors: errors
    };
}

// goBackToStep1 is already defined above (line 19)

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

