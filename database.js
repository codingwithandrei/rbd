// Local Database Management
// This file handles all database operations using localStorage when available.
// If localStorage is blocked (e.g., running from the filesystem or private mode),
// it falls back to an in-memory store so the app keeps working.

const storageProvider = (() => {
    const memoryStore = {};
    const hasLocalStorage = (() => {
        try {
            const testKey = '__db_test__';
            window.localStorage.setItem(testKey, 'test');
            window.localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('localStorage unavailable, falling back to in-memory store:', error);
            return false;
        }
    })();

    if (hasLocalStorage) {
        return {
            type: 'localStorage',
            getItem: key => window.localStorage.getItem(key),
            setItem: (key, value) => window.localStorage.setItem(key, value),
            removeItem: key => window.localStorage.removeItem(key)
        };
    }

    return {
        type: 'memory',
        getItem: key => Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null,
        setItem: (key, value) => {
            memoryStore[key] = value;
        },
        removeItem: key => {
            delete memoryStore[key];
        }
    };
})();

function readCollection(key) {
    try {
        const raw = storageProvider.getItem(key);
        if (!raw) {
            return [];
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error(`Error reading collection "${key}":`, error);
        return [];
    }
}

function writeCollection(key, data) {
    try {
        const jsonString = JSON.stringify(data);
        storageProvider.setItem(key, jsonString);
        
        // Verify the write worked
        const verify = storageProvider.getItem(key);
        if (verify !== jsonString) {
            throw new Error(`Write verification failed for "${key}"`);
        }
        
        console.log(`✓ Successfully wrote ${data.length} items to "${key}"`);
        return true;
    } catch (error) {
        console.error(`✗ Error writing collection "${key}":`, error);
        alert(`Database Error: Failed to save ${key}. Check console for details.`);
        return false;
    }
}

const DB = {
    storageType: storageProvider.type,
    getSnapshot() {
        return {
            storageType: DB.storageType,
            masterRolls: DB.masterRolls.getAll(),
            childRolls: DB.childRolls.getAll(),
            qrCodes: DB.qrCodes.getAll(),
            scanEvents: DB.scanEvents.getAll()
        };
    },
    // Database keys
    KEYS: {
        MASTER_ROLLS: 'masterRolls',
        CHILD_ROLLS: 'childRolls',
        QR_CODES: 'qrCodes',
        SCAN_EVENTS: 'scanEvents'
    },

    // Initialize database structure
    init() {
        try {
            if (!storageProvider.getItem(this.KEYS.MASTER_ROLLS)) {
                writeCollection(this.KEYS.MASTER_ROLLS, []);
            }
            if (!storageProvider.getItem(this.KEYS.CHILD_ROLLS)) {
                writeCollection(this.KEYS.CHILD_ROLLS, []);
            }
            if (!storageProvider.getItem(this.KEYS.QR_CODES)) {
                writeCollection(this.KEYS.QR_CODES, []);
            }
            if (!storageProvider.getItem(this.KEYS.SCAN_EVENTS)) {
                writeCollection(this.KEYS.SCAN_EVENTS, []);
            }
            console.log(`Database initialized using ${DB.storageType}`);
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    },

    // Clear test data (removes pre-entered test entries)
    clearTestData() {
        try {
            const testQRValues = ['123-1234', 'abc-1234', '12ab-4321'];
            
            // Remove test QR codes
            const qrCodes = this.qrCodes.getAll();
            const filteredQRCodes = qrCodes.filter(qr => !testQRValues.includes(qr.qrValue));
            writeCollection(DB.KEYS.QR_CODES, filteredQRCodes);
            
            // Remove test master rolls
            const masterRolls = this.masterRolls.getAll();
            const filteredMasterRolls = masterRolls.filter(roll => !testQRValues.includes(roll.qrValue));
            writeCollection(DB.KEYS.MASTER_ROLLS, filteredMasterRolls);
            
            // Remove test child rolls
            const childRolls = this.childRolls.getAll();
            const filteredChildRolls = childRolls.filter(roll => !testQRValues.includes(roll.masterRollQR));
            writeCollection(DB.KEYS.CHILD_ROLLS, filteredChildRolls);
            
            console.log('Test data cleared successfully');
            return true;
        } catch (error) {
            console.error('Error clearing test data:', error);
            return false;
        }
    },

    // Master Roll Operations
    masterRolls: {
        // Get all master rolls
        getAll() {
            return readCollection(DB.KEYS.MASTER_ROLLS);
        },

        // Get master roll by QR value
        getByQR(qrValue) {
            const rolls = DB.masterRolls.getAll();
            return rolls.find(roll => roll.qrValue === qrValue);
        },

        // Create a new master roll (Stage 1)
        create(data) {
            const rolls = DB.masterRolls.getAll();
            const newRoll = {
                id: Date.now().toString(),
                qrValue: data.qrValue,
                stockNumber: data.stockNumber,
                lotNumber: data.lotNumber,
                status: 'registered', // registered, slit
                createdAt: new Date().toISOString(),
                registeredAt: new Date().toISOString()
            };
            rolls.push(newRoll);
            const success = writeCollection(DB.KEYS.MASTER_ROLLS, rolls);
            if (!success) {
                throw new Error('Failed to save master roll');
            }
            
            // Verify it was saved
            const verify = DB.masterRolls.getByQR(data.qrValue);
            if (!verify) {
                console.error('Master roll save verification failed!');
                throw new Error('Master roll was not saved correctly');
            }
            
            console.log('✓ Master roll created and verified:', verify);
            return newRoll;
        },

        // Update master roll status to 'slit' (Stage 2)
        markAsSlit(qrValue) {
            const rolls = DB.masterRolls.getAll();
            const roll = rolls.find(r => r.qrValue === qrValue);
            if (roll) {
                roll.status = 'slit';
                roll.slitAt = new Date().toISOString();
                const success = writeCollection(DB.KEYS.MASTER_ROLLS, rolls);
                if (!success) {
                    throw new Error('Failed to update master roll status');
                }
                
                // Verify it was updated
                const verify = DB.masterRolls.getByQR(qrValue);
                if (!verify || verify.status !== 'slit') {
                    console.error('Master roll update verification failed!');
                    throw new Error('Master roll status was not updated correctly');
                }
                
                console.log('✓ Master roll marked as slit and verified:', verify);
            }
            return roll;
        },

        // Update master roll (e.g., during registration)
        update(qrValue, data) {
            const rolls = DB.masterRolls.getAll();
            const roll = rolls.find(r => r.qrValue === qrValue);
            if (roll) {
                Object.assign(roll, data);
                writeCollection(DB.KEYS.MASTER_ROLLS, rolls);
            }
            return roll;
        }
    },

    // Child Roll Operations
    childRolls: {
        // Get all child rolls
        getAll() {
            return readCollection(DB.KEYS.CHILD_ROLLS);
        },

        // Get child rolls by master roll QR value
        getByMasterQR(qrValue) {
            const rolls = DB.childRolls.getAll();
            return rolls.filter(roll => roll.masterRollQR === qrValue);
        },

        // Get available child rolls (status = 'AVAILABLE')
        getAvailableByMasterQR(qrValue) {
            const rolls = DB.childRolls.getByMasterQR(qrValue);
            return rolls.filter(roll => roll.status === 'AVAILABLE');
        },

        // Create child rolls (Stage 2)
        createBatch(masterRollQR, widths, jobId = null) {
            const rolls = DB.childRolls.getAll();
            const timestamp = Date.now();
            const newRolls = widths.map((width, index) => ({
                id: `${timestamp}-${index}`,
                masterRollQR: masterRollQR,
                width: width,
                status: 'AVAILABLE',
                jobId: jobId || `job-${timestamp}`,
                createdAt: new Date().toISOString()
            }));
            rolls.push(...newRolls);
            const success = writeCollection(DB.KEYS.CHILD_ROLLS, rolls);
            if (!success) {
                throw new Error('Failed to save child rolls');
            }
            
            // Verify they were saved
            const verify = DB.childRolls.getByMasterQR(masterRollQR);
            if (verify.length < rolls.length) {
                console.error('Child rolls save verification failed!', {
                    expected: rolls.length,
                    actual: verify.length
                });
                throw new Error('Child rolls were not saved correctly');
            }
            
            console.log(`✓ Created ${newRolls.length} child rolls and verified:`, newRolls);
            return newRolls;
        },

        // Mark a child roll as used (Stage 3)
        markAsUsed(childRollId) {
            const rolls = DB.childRolls.getAll();
            const roll = rolls.find(r => r.id === childRollId);
            if (roll) {
                roll.status = 'USED';
                roll.usedAt = new Date().toISOString();
                writeCollection(DB.KEYS.CHILD_ROLLS, rolls);
            }
            return roll;
        }
    },

    // QR Code Operations
    qrCodes: {
        // Get all QR codes
        getAll() {
            return readCollection(DB.KEYS.QR_CODES);
        },

        // Get QR code by value
        getByValue(qrValue) {
            const codes = DB.qrCodes.getAll();
            return codes.find(code => code.qrValue === qrValue);
        },

        // Create QR code record (when generated)
        create(data) {
            const codes = DB.qrCodes.getAll();
            const newCode = {
                qrValue: data.qrValue,
                lotNumber: data.lotNumber,
                stockNumber: data.stockNumber,
                createdAt: new Date().toISOString()
            };
            codes.push(newCode);
            const success = writeCollection(DB.KEYS.QR_CODES, codes);
            if (!success) {
                throw new Error('Failed to save QR code');
            }
            
            // Verify it was saved
            const verify = DB.qrCodes.getByValue(data.qrValue);
            if (!verify) {
                console.error('QR code save verification failed!');
                throw new Error('QR code was not saved correctly');
            }
            
            console.log('✓ QR code created and verified:', verify);
            return newCode;
        }
    },

    // Scan Event Operations
    scanEvents: {
        // Get all scan events
        getAll() {
            return readCollection(DB.KEYS.SCAN_EVENTS);
        },

        // Create scan event
        create(data) {
            const events = DB.scanEvents.getAll();
            const newEvent = {
                id: Date.now().toString(),
                qrValue: data.qrValue,
                action: data.action, // 'registration', 'slitting', 'roll_selected'
                childRollId: data.childRollId || null,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent
            };
            events.push(newEvent);
            writeCollection(DB.KEYS.SCAN_EVENTS, events);
            return newEvent;
        }
    },

    // Helper: Determine QR code stage
    getQRStage(qrValue) {
        const masterRoll = DB.masterRolls.getByQR(qrValue);
        
        if (!masterRoll) {
            // QR code exists but master roll not registered yet
            const qrCode = DB.qrCodes.getByValue(qrValue);
            if (qrCode) {
                return 'stage1'; // Needs registration
            }
            return 'not_found'; // QR code doesn't exist
        }

        if (masterRoll.status === 'registered') {
            // Check if child rolls exist
            const childRolls = DB.childRolls.getByMasterQR(qrValue);
            if (childRolls.length === 0) {
                return 'stage2'; // Needs slitting
            }
        }

        // Master roll is slit, check available rolls
        const availableRolls = DB.childRolls.getAvailableByMasterQR(qrValue);
        if (availableRolls.length === 0) {
            return 'all_used'; // All rolls used
        }

        return 'stage3'; // Can select from available rolls
    }
};

// Initialize database on load
if (typeof window !== 'undefined') {
    // Always initialize immediately
    DB.init();
    
    // Also initialize on DOM ready as backup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            DB.init();
        });
    }
}

