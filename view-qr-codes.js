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

        container.style.display = 'grid';
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

    container.style.display = 'grid';
    emptyState.style.display = 'none';
    container.innerHTML = '';

    qrCodes.forEach((qr, index) => {
        const qrCard = document.createElement('div');
        qrCard.className = 'qr-code-card';
        qrCard.id = `qr-card-${index}`;
        qrCard.innerHTML = `
            <div class="qr-code-info">
                <h4>QR Code ${index + 1}</h4>
                <p><strong>Stock Number:</strong> ${qr.stockNumber || 'N/A'}</p>
                <p><strong>Lot Number:</strong> ${qr.lotNumber || 'N/A'}</p>
                <p><strong>QR Value:</strong> ${qr.qrValue || 'N/A'}</p>
                ${qr.qrUrl ? `<p style="font-size: 0.85rem; color: var(--gray-600); margin-top: 8px; word-break: break-all;"><strong>URL:</strong> ${qr.qrUrl}</p>` : ''}
                ${qr.createdAt ? `<p style="font-size: 0.85rem; color: var(--gray-600); margin-top: 4px;"><strong>Created:</strong> ${new Date(qr.createdAt).toLocaleString()}</p>` : ''}
            </div>
            <div id="qrcode-display-${index}" class="qrcode-container"></div>
        `;
        container.appendChild(qrCard);

        // Generate QR code image
        const qrElement = document.getElementById(`qrcode-display-${index}`);
        // Use saved QR URL or construct from data
        let qrUrl = qr.qrUrl;
        if (!qrUrl) {
            // Fallback: construct URL (use production URL for consistency)
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
                    <div class="label-qr-code" id="print-qr-${index}"></div>
                    <div class="label-info">
                        <div class="label-stock"><strong>Stock:</strong> ${qr.stockNumber || 'N/A'}</div>
                        <div class="label-lot"><strong>Lot:</strong> ${qr.lotNumber || 'N/A'}</div>
                    </div>
                </div>
            `;
            printView.appendChild(labelDiv);

            // Generate QR code for print
            const qrElement = document.getElementById(`print-qr-${index}`);
            // Use saved QR URL or construct from data
            let qrUrl = qr.qrUrl;
            if (!qrUrl) {
                // Fallback: construct URL (use production URL for consistency)
                const productionUrl = 'https://rbd-weld.vercel.app';
                const isLocalhost = window.location.hostname === 'localhost' || 
                                   window.location.hostname === '127.0.0.1' || 
                                   window.location.hostname.includes('192.168.');
                const baseUrl = isLocalhost ? window.location.origin : productionUrl;
                qrUrl = `${baseUrl}/index.html?qr=${encodeURIComponent(qr.qrValue)}&lot=${encodeURIComponent(qr.lotNumber)}&stock=${encodeURIComponent(qr.stockNumber)}`;
            }
            
            try {
                // Generate QR code - sized to fit within 2in max height
                // Using 300px which will scale down to fit the 2in max
                new QRCode(qrElement, {
                    text: qrUrl,
                    width: 300,
                    height: 300,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
                
                // Ensure QR code scales to fit and doesn't get cut off
                const canvas = qrElement.querySelector('canvas');
                if (canvas) {
                    canvas.style.maxWidth = '2in';
                    canvas.style.maxHeight = '2in';
                    canvas.style.width = 'auto';
                    canvas.style.height = 'auto';
                    canvas.style.objectFit = 'contain';
                }
            } catch (error) {
                console.error('Error generating print QR code:', error);
                qrElement.innerHTML = '<p>QR Error</p>';
            }
        });

        // Show print view and trigger print
        printView.style.display = 'block';
        window.print();
        
        // Hide print view after print dialog closes
        setTimeout(() => {
            printView.style.display = 'none';
        }, 1000);
    } catch (error) {
        console.error('Error printing labels:', error);
        alert(`✗ Failed to print labels.\n\nError: ${error.message}`);
    }
}

