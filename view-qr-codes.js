// Print QR Codes functionality
let allQRCodes = [];
let filteredQRCodes = [];
let searchQuery = '';

document.addEventListener('DOMContentLoaded', async function() {
    await loadQRCodes();
});

async function loadQRCodes() {
    try {
        const loadingMessage = document.getElementById('loadingMessage');
        const container = document.getElementById('qrCodesContainer');
        const emptyState = document.getElementById('emptyState');
        
        loadingMessage.style.display = 'block';
        container.innerHTML = '';
        emptyState.style.display = 'none';

        // Get all QR codes from database
        allQRCodes = await DB.qrCodes.getAll();
        
        console.log('Loaded QR codes:', allQRCodes.length);
        
        // Sort by creation date (newest first)
        allQRCodes.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return dateB - dateA;
        });

        loadingMessage.style.display = 'none';

        if (allQRCodes.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'block';
        filteredQRCodes = allQRCodes;
        displayQRCodes(filteredQRCodes);
    } catch (error) {
        console.error('Error loading QR codes:', error);
        document.getElementById('loadingMessage').style.display = 'none';
        document.getElementById('qrCodesContainer').innerHTML = `
            <div class="error-message">
                <h3>Error Loading QR Codes</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function displayQRCodes(qrCodes) {
    const container = document.getElementById('qrCodesContainer');
    const emptyState = document.getElementById('emptyState');

    if (qrCodes.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        emptyState.innerHTML = `
            <div class="info-message">
                <h3 style="margin-bottom: 12px;">No QR Codes Found</h3>
                <p>No QR codes match your search criteria.</p>
            </div>
        `;
        return;
    }

    container.style.display = 'block';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    // Group QR codes by batchId
    const batches = {};
    const unbatched = [];
    
    qrCodes.forEach(qr => {
        if (qr.batchId) {
            if (!batches[qr.batchId]) {
                batches[qr.batchId] = [];
            }
            batches[qr.batchId].push(qr);
        } else {
            unbatched.push(qr);
        }
    });

    // Group batches by date (day)
    const batchesByDate = {};
    Object.entries(batches).forEach(([batchId, batchQRCodes]) => {
        const batchDate = batchQRCodes[0]?.createdAt ? new Date(batchQRCodes[0].createdAt) : new Date(0);
        const dateKey = batchDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        if (!batchesByDate[dateKey]) {
            batchesByDate[dateKey] = [];
        }
        
        batchesByDate[dateKey].push({
            batchId: batchId,
            qrCodes: batchQRCodes,
            date: batchDate
        });
    });

    // Sort dates (newest first)
    const sortedDates = Object.keys(batchesByDate).sort((a, b) => {
        const dateA = batchesByDate[a][0]?.date || new Date(0);
        const dateB = batchesByDate[b][0]?.date || new Date(0);
        return dateB - dateA;
    });

    let globalIndex = 0;

    // Display batches grouped by date
    sortedDates.forEach(dateKey => {
        // Create date header
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.style.cssText = `
            margin: 40px 0 20px 0;
            padding: 12px 20px;
            background: var(--primary-blue);
            color: var(--white);
            border-radius: 8px;
            font-weight: 700;
            font-size: 1.2rem;
            text-align: center;
        `;
        dateHeader.textContent = `📅 ${dateKey}`;
        container.appendChild(dateHeader);

        // Sort batches within this date by time (newest first)
        const batchesForDate = batchesByDate[dateKey].sort((a, b) => {
            return b.date - a.date;
        });

        // Display each batch for this date
        batchesForDate.forEach(({ batchId, qrCodes: batchQRCodes }) => {
            const batchDate = batchQRCodes[0]?.createdAt ? new Date(batchQRCodes[0].createdAt) : new Date(0);
            const batchTime = batchDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            });
            
            // Create collapsible batch header
            const batchHeader = document.createElement('div');
            batchHeader.className = 'batch-header-collapsible';
            batchHeader.style.cssText = `
                margin: 15px 0 10px 0;
                padding: 16px 20px;
                background: var(--light-yellow);
                border-left: 4px solid var(--accent-yellow);
                border-radius: 8px;
                font-weight: 600;
                color: var(--gray-800);
                font-size: 1.1rem;
                cursor: pointer;
                transition: all 0.2s ease;
                user-select: none;
            `;
            batchHeader.onmouseover = () => {
                batchHeader.style.background = '#fde68a';
            };
            batchHeader.onmouseout = () => {
                batchHeader.style.background = 'var(--light-yellow)';
            };
            
            batchHeader.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: var(--primary-blue);">📦 Batch:</span> 
                        ${batchQRCodes.length} QR Code${batchQRCodes.length !== 1 ? 's' : ''} 
                        <span style="color: var(--gray-600); font-size: 0.9rem; font-weight: 400; margin-left: 12px;">
                            (Generated: ${batchTime})
                        </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button 
                            class="btn btn-yellow btn-small" 
                            onclick="printBatch('${batchId}', event)"
                            style="padding: 6px 12px; font-size: 0.85rem; z-index: 10; position: relative;"
                            title="Print this batch"
                        >🖨️ Print</button>
                        <span class="batch-toggle" style="font-size: 1.2rem; color: var(--gray-600);">▼</span>
                    </div>
                </div>
            `;
            container.appendChild(batchHeader);

            // Create batch grid container (initially hidden)
            const batchGrid = document.createElement('div');
            batchGrid.className = `batch-grid-${batchId}`;
            batchGrid.style.cssText = 'display: none; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-bottom: 20px; padding: 10px 0;';
            container.appendChild(batchGrid);

            // Toggle functionality
            let isExpanded = false;
            batchHeader.addEventListener('click', () => {
                isExpanded = !isExpanded;
                const toggle = batchHeader.querySelector('.batch-toggle');
                
                if (isExpanded) {
                    batchGrid.style.display = 'grid';
                    toggle.textContent = '▲';
                    
                    // Only generate QR codes when expanded (lazy loading)
                    if (batchGrid.children.length === 0) {
                        generateBatchQRCodes(batchGrid, batchQRCodes, globalIndex);
                        globalIndex += batchQRCodes.length;
                    }
                } else {
                    batchGrid.style.display = 'none';
                    toggle.textContent = '▼';
                }
            });
        });
    });

    // Display unbatched QR codes (legacy data or CSV imports without batchId)
    if (unbatched.length > 0) {
        const unbatchedHeader = document.createElement('div');
        unbatchedHeader.className = 'batch-header';
        unbatchedHeader.style.cssText = `
            margin: 40px 0 20px 0;
            padding: 16px 20px;
            background: var(--gray-100);
            border-left: 4px solid var(--gray-600);
            border-radius: 8px;
            font-weight: 600;
            color: var(--gray-800);
            font-size: 1.1rem;
        `;
        unbatchedHeader.innerHTML = `
            <span style="color: var(--gray-600);">📋 Unbatched:</span> 
            ${unbatched.length} QR Code${unbatched.length !== 1 ? 's' : ''} 
            <span style="color: var(--gray-600); font-size: 0.9rem; font-weight: 400; margin-left: 12px;">
                (Legacy or imported without batch)
            </span>
        `;
        container.appendChild(unbatchedHeader);

        const unbatchedGrid = document.createElement('div');
        unbatchedGrid.className = 'qr-codes-grid';
        unbatchedGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px;';
        container.appendChild(unbatchedGrid);

        generateBatchQRCodes(unbatchedGrid, unbatched, globalIndex);
    }
}

// Helper function to generate QR codes for a batch
function generateBatchQRCodes(container, qrCodes, startIndex) {
    qrCodes.forEach((qr, index) => {
        const globalIndex = startIndex + index;
        const qrCard = document.createElement('div');
        qrCard.className = 'qr-code-card';
        qrCard.id = `qr-card-${globalIndex}`;
        qrCard.innerHTML = `
            <div class="qr-code-info">
                <h4>QR Code ${index + 1}${qrCodes.length > 1 ? ` of ${qrCodes.length}` : ''}</h4>
                <p><strong>Stock Number:</strong> ${qr.stockNumber || 'N/A'}</p>
                <p><strong>Lot Number:</strong> ${qr.lotNumber || 'N/A'}</p>
                <p><strong>QR Value:</strong> ${qr.qrValue || 'N/A'}</p>
                ${qr.qrUrl ? `<p style="font-size: 0.85rem; color: var(--gray-600); margin-top: 8px; word-break: break-all;"><strong>URL:</strong> ${qr.qrUrl}</p>` : ''}
                ${qr.createdAt ? `<p style="font-size: 0.85rem; color: var(--gray-600); margin-top: 4px;"><strong>Created:</strong> ${new Date(qr.createdAt).toLocaleString()}</p>` : ''}
            </div>
            <div id="qrcode-display-${globalIndex}" class="qrcode-container"></div>
        `;
        container.appendChild(qrCard);

        // Generate QR code image
        const qrElement = document.getElementById(`qrcode-display-${globalIndex}`);
        let qrUrl = qr.qrUrl;
        if (!qrUrl) {
            const productionUrl = 'https://rbd-weld.vercel.app';
            const isLocalhost = window.location.hostname === 'localhost' || 
                               window.location.hostname === '127.0.0.1' || 
                               window.location.hostname.includes('192.168.');
            const baseUrl = isLocalhost ? window.location.origin : productionUrl;
            qrUrl = `${baseUrl}/index.html?qr=${encodeURIComponent(qr.qrValue)}&lot=${encodeURIComponent(qr.lotNumber)}&stock=${encodeURIComponent(qr.stockNumber)}`;
        }
        
        try {
            new QRCode(qrElement, {
                text: qrUrl,
                width: 200,
                height: 200,
                colorDark: '#1f2937',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error('Error generating QR code:', error);
            qrElement.innerHTML = '<p style="color: var(--error-red);">Error generating QR code</p>';
        }
    });
}

// Print a specific batch
function printBatch(batchId, event) {
    // Stop event propagation to prevent batch from expanding/collapsing
    if (event) {
        event.stopPropagation();
    }
    
    try {
        // Find all QR codes in this batch
        const batchQRCodes = allQRCodes.filter(qr => qr.batchId === batchId);
        
        if (batchQRCodes.length === 0) {
            alert('No QR codes found in this batch.');
            return;
        }
        
        const printView = document.getElementById('printView');
        printView.innerHTML = '';
        
        // Create print-friendly layout for this batch only
        batchQRCodes.forEach((qr, index) => {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'label-print-item';
            labelDiv.innerHTML = `
                <div class="label-content">
                    <div class="label-top-section">
                        <div class="label-logo">
                            <img src="rbd-logo.png.png" alt="RBD Logo" />
                        </div>
                        <div class="label-qr-code" id="print-qr-${index}"></div>
                    </div>
                    <div class="label-info">
                        <div class="label-stock"><strong>Stock:</strong> ${qr.stockNumber || 'N/A'}</div>
                        <div class="label-lot"><strong>Lot:</strong> ${qr.lotNumber || 'N/A'}</div>
                    </div>
                </div>
            `;
            printView.appendChild(labelDiv);
            
            // Generate QR code for print
            const qrElement = document.getElementById(`print-qr-${index}`);
            // Always use production URL
            const productionUrl = 'https://rbd-weld.vercel.app';
            let qrUrl = qr.qrUrl;
            
            if (qrUrl && (qrUrl.includes('localhost') || qrUrl.includes('127.0.0.1') || qrUrl.includes('192.168.'))) {
                const urlObj = new URL(qrUrl);
                const qrParam = urlObj.searchParams.get('qr') || qr.qrValue;
                const lotParam = urlObj.searchParams.get('lot') || qr.lotNumber;
                const stockParam = urlObj.searchParams.get('stock') || qr.stockNumber;
                qrUrl = `${productionUrl}/index.html?qr=${encodeURIComponent(qrParam)}&lot=${encodeURIComponent(lotParam)}&stock=${encodeURIComponent(stockParam)}`;
            } else if (!qrUrl) {
                qrUrl = `${productionUrl}/index.html?qr=${encodeURIComponent(qr.qrValue)}&lot=${encodeURIComponent(qr.lotNumber)}&stock=${encodeURIComponent(qr.stockNumber)}`;
            }
            
            try {
                new QRCode(qrElement, {
                    text: qrUrl,
                    width: 120,
                    height: 120,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                
                const canvas = qrElement.querySelector('canvas');
                if (canvas) {
                    canvas.style.width = '120px';
                    canvas.style.height = '120px';
                    canvas.style.maxWidth = '120px';
                    canvas.style.maxHeight = '120px';
                    canvas.style.display = 'block';
                    canvas.style.margin = '0 auto';
                }
            } catch (error) {
                console.error('Error generating print QR code:', error);
                qrElement.innerHTML = '<p>QR Error</p>';
            }
        });
        
        // Show preview and print
        setTimeout(() => {
            printView.style.display = 'block';
            printView.style.visibility = 'visible';
            
            setTimeout(() => {
                window.print();
                
                setTimeout(() => {
                    printView.style.display = 'none';
                    printView.style.visibility = 'hidden';
                }, 1000);
            }, 300);
        }, 800);
    } catch (error) {
        console.error('Error printing batch:', error);
        alert(`✗ Failed to print batch.\n\nError: ${error.message}`);
    }
}

function handleSearch(event) {
    if (event.key === 'Enter' || event.type === 'keyup') {
        performSearch();
    }
}

function performSearch() {
    const searchInput = document.getElementById('searchInput');
    searchQuery = searchInput.value.trim().toLowerCase();

    if (!searchQuery) {
        filteredQRCodes = allQRCodes;
    } else {
        filteredQRCodes = allQRCodes.filter(qr => {
            const stockMatch = (qr.stockNumber || '').toLowerCase().includes(searchQuery);
            const lotMatch = (qr.lotNumber || '').toLowerCase().includes(searchQuery);
            const qrValueMatch = (qr.qrValue || '').toLowerCase().includes(searchQuery);
            return stockMatch || lotMatch || qrValueMatch;
        });
    }

    displayQRCodes(filteredQRCodes);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    filteredQRCodes = allQRCodes;
    displayQRCodes(filteredQRCodes);
}

function refreshQRCodes() {
    loadQRCodes();
}

// Import QR Codes from CSV
async function importQRCodesCSV() {
    // Trigger file input
    document.getElementById('csvFileInput').click();
}

// Handle CSV file selection and import
async function handleCSVFile(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    // Reset file input for future selections
    event.target.value = '';
    
    try {
        // Show loading message
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'block';
            loadingMessage.innerHTML = '<p>Importing QR codes from CSV...</p>';
        }
        
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
        
        // Refresh the display
        await refreshQRCodes();
        
    } catch (error) {
        console.error('Error importing CSV:', error);
        const loadingMessage = document.getElementById('loadingMessage');
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
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
    
    return { success, skipped, errors };
}

// Export Labels to CSV (Stock, Lot, QR URL only)
function exportLabelsCSV() {
    try {
        const codesToExport = filteredQRCodes.length > 0 ? filteredQRCodes : allQRCodes;
        
        if (codesToExport.length === 0) {
            alert('No QR codes to export.');
            return;
        }

        // Create CSV content with only label data
        let csvContent = 'Stock Number,Lot Number,QR URL\n';
        
        codesToExport.forEach(qr => {
            const stockNumber = (qr.stockNumber || '').replace(/"/g, '""');
            const lotNumber = (qr.lotNumber || '').replace(/"/g, '""');
            const qrUrl = (qr.qrUrl || '').replace(/"/g, '""');
            csvContent += `"${stockNumber}","${lotNumber}","${qrUrl}"\n`;
        });

        // Create download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const fileName = `rbd-labels-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert(`✓ Labels exported successfully!\n\nFile: ${fileName}\n\nQR Codes: ${codesToExport.length}\n\nFormat: Stock Number, Lot Number, QR URL`);
    } catch (error) {
        console.error('Error exporting labels:', error);
        alert(`✗ Failed to export labels.\n\nError: ${error.message}`);
    }
}

// Print Labels (Print-friendly view)
function printLabels() {
    try {
        const codesToPrint = filteredQRCodes.length > 0 ? filteredQRCodes : allQRCodes;
        
        if (codesToPrint.length === 0) {
            alert('No QR codes to print.');
            return;
        }

        const printView = document.getElementById('printView');
        printView.innerHTML = '';

        // Create print-friendly layout - one label per page, vertical layout
        codesToPrint.forEach((qr, index) => {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'label-print-item';
            labelDiv.innerHTML = `
                <div class="label-content">
                    <div class="label-top-section">
                        <div class="label-logo">
                            <img src="rbd-logo.png.png" alt="RBD Logo" />
                        </div>
                        <div class="label-qr-code" id="print-qr-${index}"></div>
                    </div>
                    <div class="label-info">
                        <div class="label-stock"><strong>Stock:</strong> ${qr.stockNumber || 'N/A'}</div>
                        <div class="label-lot"><strong>Lot:</strong> ${qr.lotNumber || 'N/A'}</div>
                    </div>
                </div>
            `;
            printView.appendChild(labelDiv);

            // Generate QR code for print
            const qrElement = document.getElementById(`print-qr-${index}`);
            // Always use production URL for QR codes (never localhost)
            const productionUrl = 'https://rbd-weld.vercel.app';
            let qrUrl = qr.qrUrl;
            
            // If qrUrl exists but contains localhost, replace it with production URL
            if (qrUrl && (qrUrl.includes('localhost') || qrUrl.includes('127.0.0.1') || qrUrl.includes('192.168.'))) {
                // Extract the query parameters and rebuild with production URL
                const urlObj = new URL(qrUrl);
                const qrParam = urlObj.searchParams.get('qr') || qr.qrValue;
                const lotParam = urlObj.searchParams.get('lot') || qr.lotNumber;
                const stockParam = urlObj.searchParams.get('stock') || qr.stockNumber;
                qrUrl = `${productionUrl}/index.html?qr=${encodeURIComponent(qrParam)}&lot=${encodeURIComponent(lotParam)}&stock=${encodeURIComponent(stockParam)}`;
            } else if (!qrUrl) {
                // Construct URL if not exists
                qrUrl = `${productionUrl}/index.html?qr=${encodeURIComponent(qr.qrValue)}&lot=${encodeURIComponent(qr.lotNumber)}&stock=${encodeURIComponent(qr.stockNumber)}`;
            }
            
            try {
                // Generate QR code with fixed size for print (120px = matches CSS)
                new QRCode(qrElement, {
                    text: qrUrl,
                    width: 120,  // Fixed size to match CSS
                    height: 120, // Fixed size to match CSS
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                
                // Ensure QR code has fixed dimensions for print
                const canvas = qrElement.querySelector('canvas');
                if (canvas) {
                    canvas.style.width = '120px';
                    canvas.style.height = '120px';
                    canvas.style.maxWidth = '120px';
                    canvas.style.maxHeight = '120px';
                    canvas.style.display = 'block';
                    canvas.style.margin = '0 auto';
                }
            } catch (error) {
                console.error('Error generating print QR code:', error);
                qrElement.innerHTML = '<p>QR Error</p>';
            }
        });

        // Small delay to ensure QR codes are rendered before showing preview
        setTimeout(() => {
            printView.style.display = 'block';
            printView.style.visibility = 'visible';
            
            // Additional delay to ensure all QR codes are fully rendered
            setTimeout(() => {
                // Open print dialog directly (no confirmation popup)
                window.print();
                
                // Hide print view after print dialog closes
                setTimeout(() => {
                    printView.style.display = 'none';
                    printView.style.visibility = 'hidden';
                }, 1000);
            }, 300);
        }, 800); // Delay to ensure QR codes render
    } catch (error) {
        console.error('Error printing labels:', error);
        alert(`✗ Failed to print labels.\n\nError: ${error.message}`);
    }
}

