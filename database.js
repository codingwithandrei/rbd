// Local Database Management
// This file handles all database operations using localStorage

const DB = {
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
            if (!localStorage.getItem(this.KEYS.MASTER_ROLLS)) {
                localStorage.setItem(this.KEYS.MASTER_ROLLS, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.KEYS.CHILD_ROLLS)) {
                localStorage.setItem(this.KEYS.CHILD_ROLLS, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.KEYS.QR_CODES)) {
                localStorage.setItem(this.KEYS.QR_CODES, JSON.stringify([]));
            }
            if (!localStorage.getItem(this.KEYS.SCAN_EVENTS)) {
                localStorage.setItem(this.KEYS.SCAN_EVENTS, JSON.stringify([]));
            }
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Database initialization error:', error);
        }
    },

    // Seed database with test data
    seedTestData() {
        try {
            const testData = [
                { stockNumber: '1234', lotNumber: '123' },
                { stockNumber: '1234', lotNumber: 'abc' },
                { stockNumber: '4321', lotNumber: '12ab' }
            ];

            testData.forEach(data => {
                const qrValue = `${data.lotNumber}-${data.stockNumber}`;
                
                // Create QR code if it doesn't exist
                if (!this.qrCodes.getByValue(qrValue)) {
                    this.qrCodes.create({
                        qrValue: qrValue,
                        lotNumber: data.lotNumber,
                        stockNumber: data.stockNumber
                    });
                    console.log(`Created QR code: ${qrValue}`);
                }

                // Create master roll if it doesn't exist
                if (!this.masterRolls.getByQR(qrValue)) {
                    this.masterRolls.create({
                        qrValue: qrValue,
                        stockNumber: data.stockNumber,
                        lotNumber: data.lotNumber
                    });
                    console.log(`Created master roll: ${qrValue}`);
                }
            });

            console.log('Test data seeded successfully');
            return true;
        } catch (error) {
            console.error('Error seeding test data:', error);
            return false;
        }
    },

    // Master Roll Operations
    masterRolls: {
        // Get all master rolls
        getAll() {
            try {
                const data = localStorage.getItem(DB.KEYS.MASTER_ROLLS);
                if (!data) {
                    return [];
                }
                return JSON.parse(data);
            } catch (error) {
                console.error('Error getting master rolls:', error);
                return [];
            }
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
            localStorage.setItem(DB.KEYS.MASTER_ROLLS, JSON.stringify(rolls));
            return newRoll;
        },

        // Update master roll status to 'slit' (Stage 2)
        markAsSlit(qrValue) {
            const rolls = DB.masterRolls.getAll();
            const roll = rolls.find(r => r.qrValue === qrValue);
            if (roll) {
                roll.status = 'slit';
                roll.slitAt = new Date().toISOString();
                localStorage.setItem(DB.KEYS.MASTER_ROLLS, JSON.stringify(rolls));
            }
            return roll;
        },

        // Update master roll (e.g., during registration)
        update(qrValue, data) {
            const rolls = DB.masterRolls.getAll();
            const roll = rolls.find(r => r.qrValue === qrValue);
            if (roll) {
                Object.assign(roll, data);
                localStorage.setItem(DB.KEYS.MASTER_ROLLS, JSON.stringify(rolls));
            }
            return roll;
        }
    },

    // Child Roll Operations
    childRolls: {
        // Get all child rolls
        getAll() {
            try {
                const data = localStorage.getItem(DB.KEYS.CHILD_ROLLS);
                if (!data) {
                    return [];
                }
                return JSON.parse(data);
            } catch (error) {
                console.error('Error getting child rolls:', error);
                return [];
            }
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
            localStorage.setItem(DB.KEYS.CHILD_ROLLS, JSON.stringify(rolls));
            return newRolls;
        },

        // Mark a child roll as used (Stage 3)
        markAsUsed(childRollId) {
            const rolls = DB.childRolls.getAll();
            const roll = rolls.find(r => r.id === childRollId);
            if (roll) {
                roll.status = 'USED';
                roll.usedAt = new Date().toISOString();
                localStorage.setItem(DB.KEYS.CHILD_ROLLS, JSON.stringify(rolls));
            }
            return roll;
        }
    },

    // QR Code Operations
    qrCodes: {
        // Get all QR codes
        getAll() {
            try {
                const data = localStorage.getItem(DB.KEYS.QR_CODES);
                if (!data) {
                    return [];
                }
                return JSON.parse(data);
            } catch (error) {
                console.error('Error getting QR codes:', error);
                return [];
            }
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
            localStorage.setItem(DB.KEYS.QR_CODES, JSON.stringify(codes));
            return newCode;
        }
    },

    // Scan Event Operations
    scanEvents: {
        // Get all scan events
        getAll() {
            return JSON.parse(localStorage.getItem(DB.KEYS.SCAN_EVENTS) || '[]');
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
            localStorage.setItem(DB.KEYS.SCAN_EVENTS, JSON.stringify(events));
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
            // Seed test data if database is empty
            const qrCodes = DB.qrCodes.getAll();
            if (qrCodes.length === 0) {
                DB.seedTestData();
            }
        });
    } else {
        // DOM already loaded, seed test data if empty
        const qrCodes = DB.qrCodes.getAll();
        if (qrCodes.length === 0) {
            DB.seedTestData();
        }
    }
}

