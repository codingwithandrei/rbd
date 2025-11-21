// Inventory functionality
let currentView = 'stocks'; // 'stocks', 'lots', 'details'
let selectedStockNumber = null;
let selectedLotNumber = null;
let searchQuery = '';
let searchResults = null;

document.addEventListener('DOMContentLoaded', async function() {
    // Ensure database is initialized
    if (typeof DB !== 'undefined') {
        try {
            await DB.init();
            
            // Clear test data if it exists (one-time cleanup)
            if (typeof DB.clearTestData === 'function') {
                await DB.clearTestData();
            }
            
            // Log current database state for debugging
            const snapshot = await DB.getSnapshot();
            console.log('=== INVENTORY PAGE LOADED ===');
            console.log('Database snapshot:', snapshot);
            console.log('Storage type:', DB.storageType);
            console.log('Master Rolls:', snapshot.masterRolls);
            console.log('Child Rolls:', snapshot.childRolls);
            console.log('QR Codes:', snapshot.qrCodes);
        } catch (error) {
            console.error('Failed to initialize database:', error);
        }
    }
    
    // Small delay to ensure DB is ready
    setTimeout(async () => {
        try {
            await loadInventory();
        } catch (error) {
            console.error('Error loading inventory:', error);
            const container = document.getElementById('inventoryContainer');
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <h3 style="margin-bottom: 12px;">Error Loading Inventory</h3>
                        <p>Failed to load inventory data. Please check the console for details.</p>
                        <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">Error: ${error.message}</p>
                    </div>
                    <div class="button-group" style="margin-top: 20px;">
                        <button class="btn btn-secondary" onclick="location.reload()">Reload Page</button>
                    </div>
                `;
            }
        }
    }, 100);
});

async function loadInventory() {
    const container = document.getElementById('inventoryContainer');
    if (!container) {
        console.error('Inventory container not found');
        return;
    }
    
    try {
        // If there's an active search, show search results instead
        if (searchQuery) {
            await performSearch(searchQuery);
            return;
        }
        
        if (currentView === 'stocks') {
            await displayStockGroups();
        } else if (currentView === 'lots') {
            await displayLotsForStock(selectedStockNumber);
        } else if (currentView === 'details') {
            await displayLotDetails(selectedStockNumber, selectedLotNumber);
        }
    } catch (error) {
        console.error('Error in loadInventory:', error);
        throw error;
    }
}

async function displayStockGroups() {
    const container = document.getElementById('inventoryContainer');
    if (!container) {
        console.error('❌ Container not found in displayStockGroups');
        return;
    }
    
    try {
        console.log('📊 Fetching data from Firestore...');
        console.log('📊 DB object:', DB);
        console.log('📊 DB.storageType:', DB.storageType);
        
        // Show loading state
        container.innerHTML = '<p style="text-align: center; padding: 20px;">Loading inventory...</p>';
        
        const masterRolls = await DB.masterRolls.getAll();
        console.log('📊 Master rolls fetched:', masterRolls);
        
        const qrCodes = await DB.qrCodes.getAll();
        console.log('📊 QR codes fetched:', qrCodes);
        
        const childRolls = await DB.childRolls.getAll();
        console.log('📊 Child rolls fetched:', childRolls);
    
        // Debug: Log what we have
        console.log('=== INVENTORY DEBUG ===');
        console.log('Master Rolls:', masterRolls);
        console.log('QR Codes:', qrCodes);
        console.log('Child Rolls:', childRolls);
        console.log('Total counts:', {
            masterRolls: masterRolls.length,
            qrCodes: qrCodes.length,
            childRolls: childRolls.length
        });
        
        // Helper function to convert Firestore timestamps to strings
        const convertTimestamp = (timestamp) => {
            if (!timestamp) return null;
            if (timestamp.toDate) {
                // Firestore Timestamp
                return timestamp.toDate().toISOString();
            } else if (timestamp instanceof Date) {
                return timestamp.toISOString();
            } else if (typeof timestamp === 'string') {
                return timestamp;
            }
            return null;
        };
        
        // Create a map of all items - use qrValue as unique key to avoid duplicates
        const allItems = {};
        
        // Add registered master rolls (these take priority)
        masterRolls.forEach(roll => {
            const key = roll.qrValue; // Use qrValue as unique key
            allItems[key] = {
                stockNumber: roll.stockNumber,
                lotNumber: roll.lotNumber,
                qrValue: roll.qrValue,
                status: roll.status,
                registeredAt: convertTimestamp(roll.registeredAt),
                slitAt: convertTimestamp(roll.slitAt),
                isRegistered: true
            };
        });
        
        // Add unregistered QR codes (only if not already in allItems)
        qrCodes.forEach(qr => {
            const key = qr.qrValue;
            if (!allItems[key]) {
                allItems[key] = {
                    stockNumber: qr.stockNumber,
                    lotNumber: qr.lotNumber,
                    qrValue: qr.qrValue,
                    status: 'unregistered',
                    createdAt: convertTimestamp(qr.createdAt),
                    isRegistered: false
                };
            }
        });
        
        const allItemsArray = Object.values(allItems);
        console.log('All items array:', allItemsArray);
    
        if (allItemsArray.length === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <h3 style="margin-bottom: 12px;">No QR Codes or Master Rolls Found</h3>
                    <p>No QR codes have been generated or master rolls registered yet.</p>
                    <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">
                        If you just created QR codes, try clicking the "Refresh" button.
                    </p>
                </div>
            `;
            return;
        }

        // Group by stock number (normalize stock numbers - trim whitespace)
        const stockGroups = {};
        allItemsArray.forEach(item => {
            const normalizedStock = String(item.stockNumber || '').trim();
            if (normalizedStock) {
                if (!stockGroups[normalizedStock]) {
                    stockGroups[normalizedStock] = [];
                }
                stockGroups[normalizedStock].push(item);
            }
        });
        
        console.log('Stock groups:', stockGroups);

        // Sort stock numbers
        const stockNumbers = Object.keys(stockGroups).sort();

        if (stockNumbers.length === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <h3 style="margin-bottom: 12px;">No Stock Numbers Found</h3>
                    <p>Data was found but no valid stock numbers could be extracted.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3 class="form-title" style="font-size: 1.5rem; margin-bottom: 20px;">Master Rolls by Stock Number</h3>
            <p class="form-subtitle" style="margin-bottom: 24px;">
                Click on a stock number to view all lot numbers
            </p>
            <div class="stock-groups-container">
                ${stockNumbers.map(stockNumber => {
                    const lots = stockGroups[stockNumber];
                    const totalLots = lots.length;
                    // Registered = any lot that has a master roll (isRegistered = true)
                    const registeredCount = lots.filter(r => r.isRegistered).length;
                    // Unregistered = only QR codes without master rolls
                    const unregisteredCount = lots.filter(r => !r.isRegistered).length;
                    
                    return `
                        <div class="stock-group-card" onclick="selectStock('${stockNumber}')">
                            <div class="stock-card-header">
                                <h4>Stock Number: ${stockNumber}</h4>
                                <div class="stock-badge">${totalLots} ${totalLots === 1 ? 'Lot' : 'Lots'}</div>
                            </div>
                            <div class="stock-card-body">
                                <div class="stock-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Lots:</span>
                                        <span class="stat-value">${totalLots}</span>
                                    </div>
                                    ${unregisteredCount > 0 ? `
                                    <div class="stat-item">
                                        <span class="stat-label">Unregistered:</span>
                                        <span class="stat-value" style="color: var(--gray-600);">${unregisteredCount}</span>
                                    </div>
                                    ` : ''}
                                <div class="stat-item">
                                    <span class="stat-label">Registered:</span>
                                    <span class="stat-value">${registeredCount}</span>
                                </div>
                                </div>
                            </div>
                            <div class="stock-card-footer">
                                <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); selectStock('${stockNumber}');">
                                    View Lots
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Error in displayStockGroups:', error);
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">Error Displaying Inventory</h3>
                <p>Failed to load inventory data. Please check the console for details.</p>
                <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">Error: ${error.message}</p>
                <pre style="margin-top: 12px; font-size: 0.8rem; background: var(--gray-50); padding: 12px; border-radius: 8px; overflow-x: auto;">${error.stack}</pre>
            </div>
        `;
    }
}

function selectStock(stockNumber) {
    selectedStockNumber = stockNumber;
    currentView = 'lots';
    // Clear search when navigating to lots
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    loadInventory().catch(error => {
        console.error('Error loading lots:', error);
    });
}

async function displayLotsForStock(stockNumber) {
    const container = document.getElementById('inventoryContainer');
    const masterRolls = await DB.masterRolls.getAll();
    const qrCodes = await DB.qrCodes.getAll();
    
    // Combine master rolls and QR codes
    const allItems = {};
    
    // Add registered master rolls
    masterRolls.filter(roll => roll.stockNumber === stockNumber).forEach(roll => {
        const key = roll.lotNumber;
        allItems[key] = {
            stockNumber: roll.stockNumber,
            lotNumber: roll.lotNumber,
            qrValue: roll.qrValue,
            status: roll.status,
            registeredAt: roll.registeredAt,
            slitAt: roll.slitAt,
            isRegistered: true
        };
    });
    
    // Add unregistered QR codes
    qrCodes.filter(qr => qr.stockNumber === stockNumber).forEach(qr => {
        const key = qr.lotNumber;
        if (!allItems[key]) {
            allItems[key] = {
                stockNumber: qr.stockNumber,
                lotNumber: qr.lotNumber,
                qrValue: qr.qrValue,
                status: 'unregistered',
                createdAt: qr.createdAt,
                isRegistered: false
            };
        }
    });
    
    // Filter by stock number
    const lots = Object.values(allItems);
    
    if (lots.length === 0) {
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">No Lots Found</h3>
                <p>No lots found for stock number: ${stockNumber}</p>
            </div>
            <div class="button-group" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="goBackToStocks()">Back to Stock Numbers</button>
            </div>
        `;
        return;
    }

    // Sort by lot number
    lots.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber));

    // Get child rolls for all lots
    const lotsWithData = await Promise.all(lots.map(async (roll) => {
        const childRolls = await DB.childRolls.getByMasterQR(roll.qrValue);
        const availableRolls = childRolls.filter(r => r.status === 'AVAILABLE').length;
        const usedRolls = childRolls.filter(r => r.status === 'USED').length;
        const isSlit = roll.status === 'slit' || childRolls.length > 0;
        // isUnregistered should only be true if master roll doesn't exist (QR code only)
        const isUnregistered = !roll.isRegistered;
        
        return { roll, childRolls, availableRolls, usedRolls, isSlit, isUnregistered };
    }));

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn btn-secondary btn-small" onclick="goBackToStocks()" style="margin-bottom: 16px;">
                ← Back to Stock Numbers
            </button>
            <h3 class="form-title" style="font-size: 1.5rem; margin-bottom: 8px;">
                Lot Numbers for Stock: ${stockNumber}
            </h3>
            <p class="form-subtitle" style="margin-bottom: 24px;">
                Click on a lot number to view details
            </p>
        </div>
        <div class="lots-container">
            ${lotsWithData.map(({ roll, childRolls, availableRolls, usedRolls, isSlit, isUnregistered }) => {
                // Status logic: Only show "NOT REGISTERED" if truly unregistered
                // If registered (even if slit), show "REGISTERED" with optional SLIT indicator
                const displayStatus = isUnregistered ? 'NOT REGISTERED' : 'REGISTERED';
                const statusClass = isUnregistered ? 'unregistered' : 'registered';
                
                return `
                    <div class="lot-card" onclick="selectLot('${stockNumber}', '${roll.lotNumber}')">
                        <div class="lot-card-header">
                            <h4>Lot Number: ${roll.lotNumber}</h4>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <div class="lot-status-badge ${statusClass}">
                                    ${displayStatus}
                                </div>
                                ${isSlit && !isUnregistered ? `
                                    <div class="lot-status-badge slit" style="font-size: 0.75rem; padding: 4px 8px;">
                                        SLIT
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <div class="lot-card-body">
                            <div class="lot-info-row">
                                <span class="lot-label">Stock Number:</span>
                                <span class="lot-value">${roll.stockNumber}</span>
                            </div>
                            <div class="lot-info-row">
                                <span class="lot-label">QR Value:</span>
                                <span class="lot-value">${roll.qrValue}</span>
                            </div>
                            ${isUnregistered ? `
                                <div class="lot-info-row">
                                    <span class="lot-label">Status:</span>
                                    <span class="lot-value" style="color: var(--gray-600);">QR Code generated, not yet registered</span>
                                </div>
                            ` : isSlit ? `
                                <div class="lot-info-row">
                                    <span class="lot-label">Total Rolls:</span>
                                    <span class="lot-value">${childRolls.length}</span>
                                </div>
                                <div class="lot-info-row">
                                    <span class="lot-label">Available:</span>
                                    <span class="lot-value available">${availableRolls}</span>
                                </div>
                                <div class="lot-info-row">
                                    <span class="lot-label">Used:</span>
                                    <span class="lot-value used">${usedRolls}</span>
                                </div>
                            ` : `
                                <div class="lot-info-row">
                                    <span class="lot-label">Status:</span>
                                    <span class="lot-value">Registered, not yet slit</span>
                                </div>
                            `}
                        </div>
                        <div class="lot-card-footer">
                            <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); selectLot('${stockNumber}', '${roll.lotNumber}');">
                                View Details
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function selectLot(stockNumber, lotNumber) {
    selectedStockNumber = stockNumber;
    selectedLotNumber = lotNumber;
    currentView = 'details';
    // Clear search when navigating to details
    searchQuery = '';
    document.getElementById('searchInput').value = '';
    loadInventory().catch(error => {
        console.error('Error loading lot details:', error);
    });
}

async function displayLotDetails(stockNumber, lotNumber) {
    const container = document.getElementById('inventoryContainer');
    const masterRolls = await DB.masterRolls.getAll();
    const qrCodes = await DB.qrCodes.getAll();
    
    // Find the specific master roll or QR code
    let masterRoll = masterRolls.find(roll => 
        roll.stockNumber === stockNumber && roll.lotNumber === lotNumber
    );
    
    let isUnregistered = false;
    if (!masterRoll) {
        // Check if it's an unregistered QR code
        const qrCode = qrCodes.find(qr => 
            qr.stockNumber === stockNumber && qr.lotNumber === lotNumber
        );
        
        if (qrCode) {
            // Create a mock master roll object for display
            masterRoll = {
                stockNumber: qrCode.stockNumber,
                lotNumber: qrCode.lotNumber,
                qrValue: qrCode.qrValue,
                status: 'unregistered',
                createdAt: qrCode.createdAt,
                isRegistered: false
            };
            isUnregistered = true;
        } else {
            container.innerHTML = `
                <div class="error-message">
                    <h3 style="margin-bottom: 12px;">Not Found</h3>
                    <p>No QR code or master roll found for stock: ${stockNumber}, lot: ${lotNumber}</p>
                </div>
                <div class="button-group" style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="goBackToLots()">Back to Lots</button>
                </div>
            `;
            return;
        }
    }

    // Get child rolls (only if registered)
    const childRolls = isUnregistered ? [] : await DB.childRolls.getByMasterQR(masterRoll.qrValue);
    const availableRolls = childRolls.filter(r => r.status === 'AVAILABLE');
    const usedRolls = childRolls.filter(r => r.status === 'USED');
    
    // Get scan events for this QR
    const allScanEvents = await DB.scanEvents.getAll();
    const scanEvents = allScanEvents.filter(e => e.qrValue === masterRoll.qrValue);
    const slittingEvents = scanEvents.filter(e => e.action === 'slitting');
    const jobCount = slittingEvents.length;
    
    // Group child rolls by job ID (from slitting) and usedJobId (from usage)
    const rollsByJob = {};
    childRolls.forEach(roll => {
        // Use usedJobId if available (when roll was used), otherwise use jobId (from slitting)
        const jobId = roll.usedJobId || roll.jobId || 'unknown';
        if (!rollsByJob[jobId]) {
            rollsByJob[jobId] = [];
        }
        rollsByJob[jobId].push(roll);
    });
    
    // Sort child rolls by creation time to maintain consistent numbering
    childRolls.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
            return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return a.id.localeCompare(b.id);
    });
    
    // Create job information
    const jobs = Object.keys(rollsByJob).map((jobId) => {
        const jobRolls = rollsByJob[jobId];
        const slittingEvent = slittingEvents.find(e => {
            // Try to match by timestamp (within 5 seconds)
            const eventTime = new Date(e.timestamp).getTime();
            const rollTime = new Date(jobRolls[0].createdAt).getTime();
            return Math.abs(eventTime - rollTime) < 5000;
        });
        
        return {
            jobNumber: jobId, // Use actual job ID
            jobId: jobId,
            timestamp: slittingEvent ? slittingEvent.timestamp : jobRolls[0].createdAt,
            childRolls: jobRolls,
            rollCount: jobRolls.length,
            availableCount: jobRolls.filter(r => r.status === 'AVAILABLE').length,
            usedCount: jobRolls.filter(r => r.status === 'USED').length
        };
    });

    // Group child rolls by width
    const rollsByWidth = {};
    childRolls.forEach(roll => {
        if (!rollsByWidth[roll.width]) {
            rollsByWidth[roll.width] = { available: 0, used: 0, total: 0 };
        }
        rollsByWidth[roll.width].total++;
        if (roll.status === 'AVAILABLE') {
            rollsByWidth[roll.width].available++;
        } else {
            rollsByWidth[roll.width].used++;
        }
    });

    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <button class="btn btn-secondary btn-small" onclick="goBackToLots()" style="margin-bottom: 16px;">
                ← Back to Lot Numbers
            </button>
            <h3 class="form-title" style="font-size: 1.5rem; margin-bottom: 8px;">
                Master Roll Details
            </h3>
        </div>

        <div class="details-section">
            <h4 class="details-section-title">Master Roll Information</h4>
            <div class="details-grid">
                <div class="detail-item">
                    <span class="detail-label">Stock Number:</span>
                    <span class="detail-value">${masterRoll.stockNumber}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Lot Number:</span>
                    <span class="detail-value">${masterRoll.lotNumber}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">QR Value:</span>
                    <span class="detail-value">${masterRoll.qrValue}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-badge ${isUnregistered ? 'unregistered' : 'registered'}">
                            ${isUnregistered ? 'NOT REGISTERED' : 'REGISTERED'}
                        </span>
                        ${!isUnregistered && (masterRoll.status === 'slit' || childRolls.length > 0) ? `
                            <span class="status-badge slit" style="margin-left: 8px;">
                                SLIT
                            </span>
                        ` : ''}
                    </span>
                </div>
                ${isUnregistered ? `
                    <div class="detail-item">
                        <span class="detail-label">QR Code Created:</span>
                        <span class="detail-value">${new Date(masterRoll.createdAt).toLocaleString()}</span>
                    </div>
                ` : `
                    <div class="detail-item">
                        <span class="detail-label">Registered:</span>
                        <span class="detail-value">${new Date(masterRoll.registeredAt).toLocaleString()}</span>
                    </div>
                    ${masterRoll.slitAt ? `
                        <div class="detail-item">
                            <span class="detail-label">Slit:</span>
                            <span class="detail-value">${new Date(masterRoll.slitAt).toLocaleString()}</span>
                        </div>
                    ` : ''}
                `}
            </div>
        </div>

        ${(masterRoll.status === 'slit' || childRolls.length > 0) ? `
            <div class="details-section">
                <h4 class="details-section-title">Slitting Information</h4>
                <div class="details-grid">
                    <div class="detail-item">
                        <span class="detail-label">Number of Jobs:</span>
                        <span class="detail-value">${jobCount} ${jobCount === 1 ? 'Job' : 'Jobs'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Total Rolls Created:</span>
                        <span class="detail-value">${childRolls.length}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Available Rolls:</span>
                        <span class="detail-value available">${availableRolls.length}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Used Rolls:</span>
                        <span class="detail-value used">${usedRolls.length}</span>
                    </div>
                </div>
                ${jobs.length > 0 ? `
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid var(--gray-200);">
                        <h5 style="color: var(--gray-800); margin-bottom: 16px; font-size: 1.1rem; font-weight: 600;">Job Details:</h5>
                        <div class="jobs-list">
                            ${jobs.map((job) => `
                                <div class="job-item" style="margin-bottom: 16px; padding: 16px; background: var(--gray-50); border-radius: 8px; border: 2px solid var(--gray-200);">
                                    <div class="job-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                        <span class="job-number" style="font-weight: 600; font-size: 1.1rem; color: var(--primary-blue);">Job: ${job.jobNumber}</span>
                                        <span class="job-date" style="font-size: 0.9rem; color: var(--gray-600);">${new Date(job.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div class="job-body" style="display: flex; gap: 16px; flex-wrap: wrap;">
                                        <span class="job-rolls" style="font-weight: 500;">Total: ${job.rollCount} ${job.rollCount === 1 ? 'roll' : 'rolls'}</span>
                                        <span class="job-available" style="color: var(--success-green); font-weight: 500;">Available: ${job.availableCount}</span>
                                        <span class="job-used" style="color: var(--error-red); font-weight: 500;">Used: ${job.usedCount}</span>
                                    </div>
                                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--gray-200);">
                                        <div style="font-size: 0.9rem; color: var(--gray-700); margin-bottom: 8px; font-weight: 500;">Individual Rolls:</div>
                                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                                            ${job.childRolls.map((roll, idx) => {
                                                const rollNum = childRolls.findIndex(r => r.id === roll.id) + 1;
                                                const isAvailable = roll.status === 'AVAILABLE';
                                                const usedJob = roll.usedJobId || (roll.status === 'USED' && roll.jobId ? roll.jobId : null);
                                                return `
                                                    <div style="padding: 8px 12px; background: ${isAvailable ? '#d1fae5' : '#fee2e2'}; border-radius: 6px; border: 1px solid ${isAvailable ? '#10b981' : '#ef4444'};">
                                                        <span style="font-weight: 600;">Roll ${rollNum}</span>
                                                        <span style="margin-left: 8px; color: var(--gray-700);">${roll.width}mm</span>
                                                        ${isAvailable ? '<span style="margin-left: 8px; color: #065f46; font-size: 0.85rem;">AVAILABLE</span>' : `<span style="margin-left: 8px; color: #991b1b; font-size: 0.85rem;">USED${usedJob && usedJob !== job.jobNumber ? ` (Job: ${usedJob})` : ''}</span>`}
                                                    </div>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>

            <div class="details-section">
                <h4 class="details-section-title">Roll Breakdown by Width</h4>
                <div class="rolls-breakdown">
                    ${Object.keys(rollsByWidth).sort((a, b) => parseInt(a) - parseInt(b)).map(width => {
                        const data = rollsByWidth[width];
                        return `
                            <div class="roll-breakdown-item">
                                <div class="roll-width-header">
                                    <span class="roll-width-value">${width}mm</span>
                                    <span class="roll-width-count">${data.total} ${data.total === 1 ? 'roll' : 'rolls'}</span>
                                </div>
                                <div class="roll-width-stats">
                                    <span class="roll-stat available">${data.available} Available</span>
                                    <span class="roll-stat used">${data.used} Used</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            ${childRolls.length > 0 ? `
                <div class="details-section">
                    <h4 class="details-section-title">Individual Roll Details</h4>
                    <div class="rolls-list-detailed">
                        ${childRolls.map((roll, index) => {
                            const rollNumber = index + 1;
                            const usedJobId = roll.usedJobId || (roll.status === 'USED' && roll.jobId ? roll.jobId : null);
                            return `
                            <div class="roll-detail-item ${roll.status === 'USED' ? 'used' : 'available'}">
                                <div class="roll-detail-header">
                                    <span class="roll-detail-number">Roll ${rollNumber}</span>
                                    <span class="roll-detail-status ${roll.status.toLowerCase()}">${roll.status}</span>
                                </div>
                                <div class="roll-detail-body">
                                    <span class="roll-detail-width">${roll.width}mm</span>
                                    ${roll.jobId ? `<span style="margin-left: 12px; color: var(--gray-600); font-size: 0.9rem;">Slit Job: ${roll.jobId}</span>` : ''}
                                    ${usedJobId && usedJobId !== roll.jobId ? `<span style="margin-left: 12px; color: var(--error-red); font-size: 0.9rem; font-weight: 500;">Used Job: ${usedJobId}</span>` : ''}
                                    ${roll.usedAt ? `
                                        <span class="roll-detail-date" style="display: block; margin-top: 8px; font-size: 0.85rem; color: var(--gray-600);">Used: ${new Date(roll.usedAt).toLocaleString()}</span>
                                    ` : `
                                        <span class="roll-detail-date" style="display: block; margin-top: 8px; font-size: 0.85rem; color: var(--gray-600);">Created: ${new Date(roll.createdAt).toLocaleString()}</span>
                                    `}
                                </div>
                            </div>
                        `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}
        ` : isUnregistered ? `
            <div class="details-section">
                <div class="info-message">
                    <p><strong>QR Code Generated - Not Yet Registered</strong></p>
                    <p style="margin-top: 8px;">This QR code has been generated but the master roll has not been registered yet.</p>
                    <p style="margin-top: 8px;">To register this master roll, scan the QR code or go to Master Roll Registration.</p>
                    <div class="button-group" style="margin-top: 16px;">
                        <button class="btn btn-primary" onclick="navigateTo('master-roll.html?qr=${encodeURIComponent(masterRoll.qrValue)}&lot=${encodeURIComponent(masterRoll.lotNumber)}&stock=${encodeURIComponent(masterRoll.stockNumber)}')">
                            Register Master Roll
                        </button>
                    </div>
                </div>
            </div>
        ` : `
            <div class="details-section">
                <div class="info-message">
                    <p>This master roll has been registered but has not been slit yet.</p>
                    <p style="margin-top: 8px;">No child rolls have been created.</p>
                </div>
            </div>
        `}
    `;
}

function goBackToStocks() {
    currentView = 'stocks';
    selectedStockNumber = null;
    selectedLotNumber = null;
    loadInventory();
}

function goBackToLots() {
    currentView = 'lots';
    selectedLotNumber = null;
    loadInventory();
}

async function refreshInventory() {
    // Force reload from database
    console.log('Refreshing inventory...');
    const snapshot = await DB.getSnapshot();
    console.log('Current database state:', snapshot);
    console.log('Master Rolls count:', snapshot.masterRolls.length);
    console.log('QR Codes count:', snapshot.qrCodes.length);
    console.log('Child Rolls count:', snapshot.childRolls.length);
    
    // Reset to stocks view
    currentView = 'stocks';
    selectedStockNumber = null;
    selectedLotNumber = null;
    searchQuery = '';
    searchResults = null;
    document.getElementById('searchInput').value = '';
    
    await loadInventory();
}

// Search functionality
async function handleSearch(event) {
    if (event.key === 'Enter' || event.type === 'click') {
        const query = document.getElementById('searchInput').value.trim().toLowerCase();
        searchQuery = query;
        
        if (!query) {
            searchResults = null;
            currentView = 'stocks';
            selectedStockNumber = null;
            selectedLotNumber = null;
            await loadInventory();
            return;
        }
        
        // Perform search
        await performSearch(query);
    }
}

async function performSearch(query) {
    const container = document.getElementById('inventoryContainer');
    container.innerHTML = '<p style="text-align: center; padding: 20px;">Searching...</p>';
    
    try {
        // Get all data
        const masterRolls = await DB.masterRolls.getAll();
        const qrCodes = await DB.qrCodes.getAll();
        const childRolls = await DB.childRolls.getAll();
        
        // Search results
        const matchingMasterRolls = [];
        const matchingQRCodes = [];
        const matchingJobs = new Set();
        const matchingJobRolls = new Map(); // Map job ID to master roll QR values
        
        // Search master rolls and QR codes by stock/lot number
        [...masterRolls, ...qrCodes].forEach(item => {
            const stockMatch = item.stockNumber && item.stockNumber.toLowerCase().includes(query);
            const lotMatch = item.lotNumber && item.lotNumber.toLowerCase().includes(query);
            
            if (stockMatch || lotMatch) {
                if (item.status !== undefined) {
                    matchingMasterRolls.push(item);
                } else {
                    matchingQRCodes.push(item);
                }
            }
        });
        
        // Search child rolls by job number
        childRolls.forEach(roll => {
            const jobId = roll.jobId || roll.usedJobId || '';
            if (jobId.toLowerCase().includes(query)) {
                matchingJobs.add(jobId);
                // Find the master roll for this child roll
                const masterRoll = masterRolls.find(mr => mr.qrValue === roll.masterRollQR);
                if (masterRoll) {
                    if (!matchingJobRolls.has(jobId)) {
                        matchingJobRolls.set(jobId, []);
                    }
                    matchingJobRolls.get(jobId).push(masterRoll);
                    // Add to matching master rolls if not already there
                    if (!matchingMasterRolls.find(mr => mr.qrValue === masterRoll.qrValue)) {
                        matchingMasterRolls.push(masterRoll);
                    }
                }
            }
        });
        
        // Combine and deduplicate results
        const allMatches = {};
        [...matchingMasterRolls, ...matchingQRCodes].forEach(item => {
            const key = item.qrValue || `${item.lotNumber}-${item.stockNumber}`;
            if (!allMatches[key]) {
                allMatches[key] = item;
            }
        });
        
        const results = Object.values(allMatches);
        
        // Display results
        if (results.length === 0 && matchingJobs.size === 0) {
            container.innerHTML = `
                <div class="error-message">
                    <h3 style="margin-bottom: 12px;">No Results Found</h3>
                    <p>No matches found for "${query}"</p>
                    <p style="margin-top: 12px; font-size: 0.9rem;">Try searching by:</p>
                    <ul style="margin-top: 8px; padding-left: 20px; font-size: 0.9rem;">
                        <li>Stock Number</li>
                        <li>Lot Number</li>
                        <li>Job Number</li>
                    </ul>
                </div>
                <div class="button-group" style="margin-top: 20px;">
                    <button class="btn btn-secondary" onclick="clearSearch()">Clear Search</button>
                </div>
            `;
            return;
        }
        
        // Group results by stock number
        const stockGroups = {};
        results.forEach(item => {
            const stock = item.stockNumber || 'Unknown';
            if (!stockGroups[stock]) {
                stockGroups[stock] = [];
            }
            stockGroups[stock].push(item);
        });
        
        // Display search results
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <button class="btn btn-secondary btn-small" onclick="clearSearch()" style="margin-bottom: 16px;">
                    ← Clear Search
                </button>
                <h3 class="form-title" style="font-size: 1.5rem; margin-bottom: 8px;">
                    Search Results for "${query}"
                </h3>
                <p class="form-subtitle" style="margin-bottom: 24px;">
                    Found ${results.length} ${results.length === 1 ? 'match' : 'matches'}${matchingJobs.size > 0 ? ` across ${matchingJobs.size} ${matchingJobs.size === 1 ? 'job' : 'jobs'}` : ''}
                </p>
            </div>
            ${Object.keys(stockGroups).length > 0 ? `
            <div class="stock-groups-container">
                ${Object.keys(stockGroups).sort().map(stockNumber => {
                    const lots = stockGroups[stockNumber];
                    const totalLots = lots.length;
                    const registeredCount = lots.filter(r => r.status && r.status === 'registered').length;
                    const unregisteredCount = lots.filter(r => !r.status || r.status === 'unregistered').length;
                    
                    return `
                        <div class="stock-group-card" onclick="selectStock('${stockNumber}')">
                            <div class="stock-card-header">
                                <h4>Stock Number: ${stockNumber}</h4>
                                <div class="stock-badge">${totalLots} ${totalLots === 1 ? 'Lot' : 'Lots'}</div>
                            </div>
                            <div class="stock-card-body">
                                <div class="stock-stats">
                                    <div class="stat-item">
                                        <span class="stat-label">Total Lots:</span>
                                        <span class="stat-value">${totalLots}</span>
                                    </div>
                                    ${unregisteredCount > 0 ? `
                                    <div class="stat-item">
                                        <span class="stat-label">Unregistered:</span>
                                        <span class="stat-value" style="color: var(--gray-600);">${unregisteredCount}</span>
                                    </div>
                                    ` : ''}
                                    <div class="stat-item">
                                        <span class="stat-label">Registered:</span>
                                        <span class="stat-value">${registeredCount}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="stock-card-footer">
                                <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); selectStock('${stockNumber}');">
                                    View Lots
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            ` : ''}
            ${matchingJobs.size > 0 ? `
                <div style="margin-top: 24px; padding-top: 24px; border-top: 2px solid var(--gray-200);">
                    <h4 style="color: var(--gray-800); margin-bottom: 12px; font-weight: 600;">Matching Job Numbers:</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                        ${Array.from(matchingJobs).map(jobId => `
                            <span style="padding: 8px 12px; background: var(--primary-blue); color: white; border-radius: 6px; font-weight: 500;">
                                ${jobId}
                            </span>
                        `).join('')}
                    </div>
                    <p style="font-size: 0.9rem; color: var(--gray-600);">
                        Click on a stock number above to see the lots associated with these jobs.
                    </p>
                </div>
            ` : ''}
        `;
        
    } catch (error) {
        console.error('Error performing search:', error);
        container.innerHTML = `
            <div class="error-message">
                <h3 style="margin-bottom: 12px;">Search Error</h3>
                <p>Failed to perform search. Please try again.</p>
                <p style="margin-top: 12px; font-size: 0.9rem; color: var(--gray-600);">Error: ${error.message}</p>
            </div>
            <div class="button-group" style="margin-top: 20px;">
                <button class="btn btn-secondary" onclick="clearSearch()">Clear Search</button>
            </div>
        `;
    }
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    searchQuery = '';
    searchResults = null;
    currentView = 'stocks';
    selectedStockNumber = null;
    selectedLotNumber = null;
    loadInventory().catch(error => {
        console.error('Error loading inventory:', error);
    });
}


