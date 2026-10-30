// Firestore Database Management
// This file handles all database operations using Firebase Firestore

const DB = {
    storageType: 'firestore',

    // Departments a roll moves through; each scan records one automatically
    DEPARTMENTS: {
        INVENTORY: 'Inventory',   // master roll received
        SLITTING: 'Slitting',     // master roll slit into child rolls
        PRINTING: 'Printing',     // child roll sent to print presses (final step)
        PRODUCTION: 'Production'  // child roll used on a job without printing (final step)
    },

    // Default slit widths (mm) - these fit the print presses
    PRINT_SIZES: [225, 241, 325],

    // Master rolls are 1300mm wide and about 6000m long (the receiver enters the real length)
    MASTER_WIDTH_MM: 1300,
    MASTER_LENGTH_M: 6000,

    // Offcut left over from a run (master width minus the lanes): narrower than this is scrapped,
    // this wide or wider goes back to inventory as its own master roll (same lot, new stock number)
    OFFCUT_MIN_MM: 158,

    // Offcut stock numbers: 0410 + width in mm + a 3-digit count per width, e.g. the first 200mm offcut is 0410200001.
    // The count lives in counters/offcut-<width> so it can later be set to match the main system's count.
    OFFCUT_STOCK_PREFIX: '0410',

    offcutStockNumber(widthMm, count) {
        return `${DB.OFFCUT_STOCK_PREFIX}${widthMm}${String(count).padStart(3, '0')}`;
    },

    _offcutCounterRef(widthMm) {
        return DB._getDB().collection('counters').doc(`offcut-${widthMm}`);
    },

    // Stock number the next offcut of this width will get (the real one is assigned when the run is saved)
    async nextOffcutStockNumber(widthMm) {
        const counter = await DB._offcutCounterRef(widthMm).get();
        return DB.offcutStockNumber(widthMm, counter.exists ? counter.data().next : 1);
    },

    // Width of a master roll (offcut masters are narrower than 1300mm)
    masterWidth(masterRoll) {
        return (masterRoll && masterRoll.widthMm) || DB.MASTER_WIDTH_MM;
    },

    // Child roll labels: printed blank, linked to a roll at the slitter
    LABEL_STATUS: {
        BLANK: 'BLANK',
        LINKED: 'LINKED'
    },

    // Base URL encoded in printed QR codes (always the live site, even when printed locally)
    PRODUCTION_URL: 'https://rbd-weld.vercel.app',

    // Masters received before meter tracking have no lengthTotal and use the old one-time slit flow
    isMeterTracked(masterRoll) {
        return !!masterRoll && (masterRoll.lengthTotal !== undefined || masterRoll.status === 'registered');
    },

    // Meters left on a master (masters received before meter tracking but not slit count as full)
    metersLeft(masterRoll) {
        if (!masterRoll) return 0;
        if (masterRoll.lengthRemaining !== undefined) return masterRoll.lengthRemaining;
        return masterRoll.status === 'registered' ? DB.MASTER_LENGTH_M : 0;
    },

    // Get Firestore instance
    _getDB() {
        const db = getFirestore();
        if (!db) {
            console.error('❌ Firestore instance is null! Firebase may not be initialized.');
            throw new Error('Firestore not initialized');
        }
        return db;
    },
    
    // Helper to convert Firestore document to plain object
    _docToObject(doc) {
        const data = doc.data();
        // Convert Firestore Timestamps to ISO strings
        const converted = {};
        for (const key in data) {
            if (data[key] && typeof data[key] === 'object' && data[key].toDate) {
                // Firestore Timestamp
                converted[key] = data[key].toDate().toISOString();
            } else {
                converted[key] = data[key];
            }
        }
        return { id: doc.id, ...converted };
    },
    
    // Initialize database (Firebase initialization)
    async init() {
        try {
            await initializeFirebase();
            console.log('✓ Database initialized using Firestore');
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        }
    },
    
    // Get snapshot of all data
    async getSnapshot() {
        try {
            const [masterRolls, childRolls, qrCodes, scanEvents] = await Promise.all([
                this.masterRolls.getAll(),
                this.childRolls.getAll(),
                this.qrCodes.getAll(),
                this.scanEvents.getAll()
            ]);
            return {
                storageType: this.storageType,
                masterRolls,
                childRolls,
                qrCodes,
                scanEvents
            };
        } catch (error) {
            console.error('Error getting snapshot:', error);
            return {
                storageType: this.storageType,
                masterRolls: [],
                childRolls: [],
                qrCodes: [],
                scanEvents: []
            };
        }
    },
    
    // Clear test data
    async clearTestData() {
        try {
            const testQRValues = ['123-1234', 'abc-1234', '12ab-4321'];
            const db = this._getDB();
            
            // Remove test QR codes
            const qrCodesSnapshot = await db.collection('qrCodes').where('qrValue', 'in', testQRValues).get();
            const qrBatch = db.batch();
            qrCodesSnapshot.forEach(doc => qrBatch.delete(doc.ref));
            await qrBatch.commit();
            
            // Remove test master rolls
            const masterRollsSnapshot = await db.collection('masterRolls').where('qrValue', 'in', testQRValues).get();
            const masterBatch = db.batch();
            masterRollsSnapshot.forEach(doc => masterBatch.delete(doc.ref));
            await masterBatch.commit();
            
            // Remove test child rolls
            const childRollsSnapshot = await db.collection('childRolls').where('masterRollQR', 'in', testQRValues).get();
            const childBatch = db.batch();
            childRollsSnapshot.forEach(doc => childBatch.delete(doc.ref));
            await childBatch.commit();
            
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
        async getAll() {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('masterRolls').get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting master rolls:', error);
                return [];
            }
        },

        // Get master roll by QR value
        async getByQR(qrValue) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('masterRolls').where('qrValue', '==', qrValue).limit(1).get();
                if (snapshot.empty) return null;
                return DB._docToObject(snapshot.docs[0]);
            } catch (error) {
                console.error('Error getting master roll by QR:', error);
                return null;
            }
        },

        // Create a new master roll
        async create(data) {
            try {
                const db = DB._getDB();
                const newRoll = {
                    qrValue: data.qrValue,
                    stockNumber: data.stockNumber,
                    lotNumber: data.lotNumber,
                    status: 'registered',
                    currentDepartment: DB.DEPARTMENTS.INVENTORY,
                    widthMm: DB.MASTER_WIDTH_MM,
                    lengthTotal: data.lengthM || DB.MASTER_LENGTH_M,
                    lengthRemaining: data.lengthM || DB.MASTER_LENGTH_M,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    registeredAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                const docRef = await db.collection('masterRolls').add(newRoll);
                const saved = await docRef.get();
                const savedData = DB._docToObject(saved);
                
                console.log('✓ Master roll created:', savedData);
                return savedData;
            } catch (error) {
                console.error('Error creating master roll:', error);
                throw new Error('Failed to save master roll: ' + error.message);
            }
        },

        // Update master roll status to 'slit'
        async markAsSlit(qrValue) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('masterRolls').where('qrValue', '==', qrValue).limit(1).get();
                
                if (snapshot.empty) {
                    throw new Error('Master roll not found');
                }
                
                const docRef = snapshot.docs[0].ref;
                await docRef.update({
                    status: 'slit',
                    currentDepartment: DB.DEPARTMENTS.SLITTING,
                    slitAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const updated = await docRef.get();
                const updatedData = DB._docToObject(updated);
                console.log('✓ Master roll marked as slit:', updatedData);
                return updatedData;
            } catch (error) {
                console.error('Error updating master roll status:', error);
                throw new Error('Failed to update master roll status: ' + error.message);
            }
        },

        // Update master roll
        async update(qrValue, data) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('masterRolls').where('qrValue', '==', qrValue).limit(1).get();
                
                if (snapshot.empty) {
                    return null;
                }
                
                const docRef = snapshot.docs[0].ref;
                await docRef.update(data);
                
                const updated = await docRef.get();
                return DB._docToObject(updated);
            } catch (error) {
                console.error('Error updating master roll:', error);
                return null;
            }
        }
    },

    // Child Roll Operations
    childRolls: {
        // Get all child rolls
        async getAll() {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('childRolls').get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting child rolls:', error);
                return [];
            }
        },

        // Get child rolls by master roll QR value
        async getByMasterQR(qrValue) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('childRolls').where('masterRollQR', '==', qrValue).get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting child rolls by master QR:', error);
                return [];
            }
        },

        // Get available child rolls
        async getAvailableByMasterQR(qrValue) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('childRolls')
                    .where('masterRollQR', '==', qrValue)
                    .where('status', '==', 'AVAILABLE')
                    .get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting available child rolls:', error);
                return [];
            }
        },

        // Create child rolls batch
        async createBatch(masterRollQR, widths, jobId = null) {
            try {
                const db = DB._getDB();
                
                // Check if child rolls already exist for this master roll
                const existing = await db.collection('childRolls')
                    .where('masterRollQR', '==', masterRollQR)
                    .get();
                
                if (!existing.empty) {
                    console.warn(`Child rolls already exist for master roll ${masterRollQR}. Found ${existing.size} existing rolls.`);
                    throw new Error(`This master roll has already been slit. ${existing.size} child rolls already exist.`);
                }
                
                const batch = db.batch();
                const timestamp = Date.now();
                const randomSuffix = Math.random().toString(36).substring(2, 9); // Add randomness to prevent collisions
                const newRolls = [];
                
                console.log(`Creating ${widths.length} child rolls for master roll ${masterRollQR}`);
                
                widths.forEach((width, index) => {
                    const rollData = {
                        masterRollQR: masterRollQR,
                        width: width,
                        status: 'AVAILABLE',
                        currentDepartment: DB.DEPARTMENTS.SLITTING,
                        jobId: jobId || `job-${timestamp}`,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    // Use more unique ID: timestamp + random + index
                    const docRef = db.collection('childRolls').doc(`${timestamp}-${randomSuffix}-${index}`);
                    batch.set(docRef, rollData);
                    newRolls.push({ id: docRef.id, ...rollData });
                });
                
                await batch.commit();
                console.log(`✓ Created ${newRolls.length} child rolls successfully`);
                return newRolls;
            } catch (error) {
                console.error('Error creating child rolls:', error);
                throw new Error('Failed to save child rolls: ' + error.message);
            }
        },

        // Mark a child roll as used - department is Printing or Production (both final)
        async markAsUsed(childRollId, jobId = null, department = DB.DEPARTMENTS.PRODUCTION) {
            try {
                const db = DB._getDB();
                const docRef = db.collection('childRolls').doc(childRollId);
                const updateData = {
                    status: 'USED',
                    currentDepartment: department,
                    printed: department === DB.DEPARTMENTS.PRINTING,
                    usedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Add job ID if provided
                if (jobId) {
                    updateData.usedJobId = jobId;
                }
                
                await docRef.update(updateData);
                
                const updated = await docRef.get();
                return DB._docToObject(updated);
            } catch (error) {
                // Rethrow so the page shows the failure instead of a false "marked as used"
                console.error('Error marking child roll as used:', error);
                throw new Error('Failed to mark roll as used: ' + error.message);
            }
        },

        // Get a child roll by ID (new rolls use their label code as the ID)
        async getById(childRollId) {
            const db = DB._getDB();
            const doc = await db.collection('childRolls').doc(childRollId).get();
            return doc.exists ? DB._docToObject(doc) : null;
        }
    },

    // Roll Label Operations - blank QR labels printed ahead of time, linked to a child roll at the slitter
    rollLabels: {
        // No 0/O/1/I so codes are easy to read and type
        _CODE_CHARS: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',

        // "B-0001" style number printed big on the label
        shortNo(number) {
            return 'B-' + String(number).padStart(4, '0');
        },

        // Full code in the QR: short number plus a random part so codes can't be guessed
        _newCode(number) {
            const chars = this._CODE_CHARS;
            const random = new Uint32Array(6);
            crypto.getRandomValues(random);
            const suffix = Array.from(random, n => chars[n % chars.length]).join('');
            return `${this.shortNo(number)}-${suffix}`;
        },

        // URL encoded in the label's QR (opens the roll page when scanned with a phone camera).
        // Kept short (no index.html) so the QR has fewer, bigger squares and scans more easily.
        url(code) {
            return `${DB.PRODUCTION_URL}/?label=${encodeURIComponent(code)}`;
        },

        // Read what a scanner returned: a label URL, a full code, or a typed number like "B-0001" / "12"
        parse(text) {
            const value = String(text || '').trim();
            if (!value) return null;
            try {
                const label = new URL(value).searchParams.get('label');
                if (label) return { code: label.toUpperCase() };
                return { otherUrl: value };
            } catch (e) {
                // Not a URL
            }
            const upper = value.toUpperCase();
            if (/^B-\d{4,}-[A-Z0-9]{6}$/.test(upper)) return { code: upper };
            const digits = upper.match(/^(?:B-?)?0*(\d+)$/);
            if (digits) return { shortNo: this.shortNo(parseInt(digits[1], 10)) };
            return null;
        },

        // Get a label by its full code
        async get(code) {
            const db = DB._getDB();
            const doc = await db.collection('rollLabels').doc(code).get();
            return doc.exists ? DB._docToObject(doc) : null;
        },

        // Get a label by its printed number (for typing it in when the camera can't read it)
        async getByShortNo(shortNo) {
            const db = DB._getDB();
            const snapshot = await db.collection('rollLabels').where('shortNo', '==', shortNo).limit(1).get();
            return snapshot.empty ? null : DB._docToObject(snapshot.docs[0]);
        },

        // All labels not yet linked to a roll, lowest number first (for printing them again)
        async getBlank() {
            const db = DB._getDB();
            const snapshot = await db.collection('rollLabels').where('status', '==', DB.LABEL_STATUS.BLANK).get();
            return snapshot.docs.map(doc => DB._docToObject(doc)).sort((a, b) => a.number - b.number);
        },

        // Resolve scanner text to a label record (null if it isn't one of our labels)
        async resolve(text) {
            const parsed = this.parse(text);
            if (!parsed || parsed.otherUrl) return null;
            return parsed.code ? this.get(parsed.code) : this.getByShortNo(parsed.shortNo);
        },

        // Reserve the next numbers and save that many blank labels
        async createBlankBatch(count) {
            const db = DB._getDB();
            const counterRef = db.collection('counters').doc('rollLabels');
            const firstNumber = await db.runTransaction(async (tx) => {
                const counter = await tx.get(counterRef);
                const next = counter.exists ? counter.data().next : 1;
                tx.set(counterRef, { next: next + count }, { merge: true });
                return next;
            });

            const printBatchId = `labels-${Date.now()}`;
            const batch = db.batch();
            const labels = [];
            for (let i = 0; i < count; i++) {
                const number = firstNumber + i;
                const code = this._newCode(number);
                const label = {
                    code: code,
                    shortNo: this.shortNo(number),
                    number: number,
                    status: DB.LABEL_STATUS.BLANK,
                    childRollId: null,
                    printBatchId: printBatchId,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                batch.set(db.collection('rollLabels').doc(code), label);
                labels.push({ id: code, ...label });
            }
            await batch.commit();
            return labels;
        }
    },

    // Slitting Run Operations - one run cuts one length off a master into one or more lanes
    slitRuns: {
        // All runs for a master roll, oldest first
        async getByMaster(masterRollQR) {
            const db = DB._getDB();
            const snapshot = await db.collection('slitRuns').where('masterRollQR', '==', masterRollQR).get();
            return snapshot.docs.map(doc => DB._docToObject(doc))
                .sort((a, b) => (a.runNumber || 0) - (b.runNumber || 0));
        },

        // Save a run in one transaction: child rolls, linked labels, the offcut, the run, and the master's meters left.
        // Either everything saves or nothing does.
        // offcut: { keep, labelCode } - keep=true puts it back in inventory as its own master roll with the next offcut stock number
        async finish({ masterRollQR, jobId, widths, lengthM, labelCodes, offcut, userEmail }) {
            const db = DB._getDB();
            const keepOffcut = !!(offcut && offcut.keep);
            if (widths.length !== labelCodes.length) {
                throw new Error('Every roll needs a label');
            }
            if (keepOffcut && !offcut.labelCode) {
                throw new Error('The offcut needs a label');
            }
            const allCodes = keepOffcut ? [...labelCodes, offcut.labelCode] : labelCodes;
            if (new Set(allCodes).size !== allCodes.length) {
                throw new Error('The same label was scanned twice');
            }

            const snapshot = await db.collection('masterRolls').where('qrValue', '==', masterRollQR).limit(1).get();
            if (snapshot.empty) {
                throw new Error('Master roll not found');
            }
            const masterRef = snapshot.docs[0].ref;
            const runRef = db.collection('slitRuns').doc();
            const labelRefs = allCodes.map(code => db.collection('rollLabels').doc(code));
            const offcutMasterRef = keepOffcut ? db.collection('masterRolls').doc() : null;

            return db.runTransaction(async (tx) => {
                // Firestore needs all reads before any writes
                const masterDoc = await tx.get(masterRef);
                const labelDocs = await Promise.all(labelRefs.map(ref => tx.get(ref)));

                const master = masterDoc.data();
                if (!DB.isMeterTracked(master)) {
                    throw new Error('This master roll was slit the old way and has no meters to track');
                }
                const left = DB.metersLeft(master);
                if (lengthM > left) {
                    throw new Error(`Only ${left} m left on this master roll`);
                }
                const masterWidth = DB.masterWidth(master);
                const offcutWidth = masterWidth - widths.reduce((sum, w) => sum + w, 0);
                if (offcutWidth < 0) {
                    throw new Error(`Rolls add up to more than the ${masterWidth}mm master width`);
                }
                if (keepOffcut && offcutWidth < DB.OFFCUT_MIN_MM) {
                    throw new Error(`Offcuts under ${DB.OFFCUT_MIN_MM}mm are scrapped, not kept`);
                }
                labelDocs.forEach((doc, i) => {
                    if (!doc.exists) {
                        throw new Error(`${allCodes[i]} is not one of our labels`);
                    }
                    if (doc.data().status !== DB.LABEL_STATUS.BLANK) {
                        throw new Error(`${doc.data().shortNo} is already on another roll`);
                    }
                });

                // Take the next offcut count for this width (read inside the transaction so two runs can't share a number)
                let offcutStock = null;
                const offcutCounterRef = keepOffcut ? DB._offcutCounterRef(offcutWidth) : null;
                let offcutCount = 1;
                if (keepOffcut) {
                    const counter = await tx.get(offcutCounterRef);
                    offcutCount = counter.exists ? counter.data().next : 1;
                    offcutStock = DB.offcutStockNumber(offcutWidth, offcutCount);
                }

                const now = firebase.firestore.FieldValue.serverTimestamp();
                const remaining = left - lengthM;
                const runNumber = (master.runCount || 0) + 1;

                labelCodes.forEach((code, i) => {
                    const doc = labelDocs[i];
                    tx.set(db.collection('childRolls').doc(code), {
                        masterRollQR: masterRollQR,
                        lotNumber: master.lotNumber,
                        stockNumber: master.stockNumber,
                        width: widths[i],
                        lengthM: lengthM,
                        lane: i + 1,
                        runId: runRef.id,
                        runNumber: runNumber,
                        labelCode: code,
                        labelNo: doc.data().shortNo,
                        status: 'AVAILABLE',
                        currentDepartment: DB.DEPARTMENTS.SLITTING,
                        jobId: jobId,
                        createdAt: now
                    });
                    tx.update(labelRefs[i], {
                        status: DB.LABEL_STATUS.LINKED,
                        childRollId: code,
                        masterRollQR: masterRollQR,
                        linkedAt: now
                    });
                });

                // Offcut kept: it becomes its own master roll, scanned by its roll label (the label code is its QR value)
                const offcutAction = offcutWidth === 0 ? 'none' : (keepOffcut ? 'kept' : 'scrapped');
                if (keepOffcut) {
                    const offcutLabelIndex = labelCodes.length;
                    tx.set(offcutMasterRef, {
                        qrValue: offcut.labelCode,
                        labelNo: labelDocs[offcutLabelIndex].data().shortNo,
                        lotNumber: master.lotNumber,
                        stockNumber: offcutStock,
                        status: 'registered',
                        isOffcut: true,
                        parentMasterQR: masterRollQR,
                        fromRunId: runRef.id,
                        currentDepartment: DB.DEPARTMENTS.INVENTORY,
                        widthMm: offcutWidth,
                        lengthTotal: lengthM,
                        lengthRemaining: lengthM,
                        createdAt: now,
                        registeredAt: now
                    });
                    tx.update(labelRefs[offcutLabelIndex], {
                        status: DB.LABEL_STATUS.LINKED,
                        offcutMasterQR: offcut.labelCode,
                        masterRollQR: masterRollQR,
                        linkedAt: now
                    });
                    tx.set(offcutCounterRef, { next: offcutCount + 1 }, { merge: true });
                }

                tx.set(runRef, {
                    masterRollQR: masterRollQR,
                    runNumber: runNumber,
                    jobId: jobId,
                    lanes: widths.length,
                    widths: widths,
                    lengthM: lengthM,
                    labelCodes: labelCodes,
                    offcutWidthMm: offcutWidth,
                    offcutAction: offcutAction,
                    offcutLabelCode: keepOffcut ? offcut.labelCode : null,
                    offcutStockNumber: offcutStock,
                    lengthBefore: left,
                    lengthAfter: remaining,
                    createdBy: userEmail || null,
                    createdAt: now
                });

                const masterUpdate = {
                    lengthTotal: master.lengthTotal || DB.MASTER_LENGTH_M,
                    lengthRemaining: remaining,
                    runCount: runNumber,
                    status: remaining === 0 ? 'used_up' : 'slit',
                    currentDepartment: DB.DEPARTMENTS.SLITTING,
                    lastRunAt: now
                };
                if (!master.slitAt) {
                    masterUpdate.slitAt = now;
                }
                tx.update(masterRef, masterUpdate);

                return { runId: runRef.id, runNumber: runNumber, remaining: remaining, offcutWidth: offcutWidth, offcutAction: offcutAction, offcutStockNumber: offcutStock };
            });
        }
    },

    // QR Code Operations
    qrCodes: {
        // Get all QR codes
        async getAll() {
            try {
                const db = DB._getDB();
                console.log('📋 Fetching all QR codes from Firestore...');
                const snapshot = await db.collection('qrCodes').get();
                const codes = snapshot.docs.map(doc => DB._docToObject(doc));
                console.log(`✅ Retrieved ${codes.length} QR codes:`, codes);
                return codes;
            } catch (error) {
                console.error('❌ Error getting QR codes:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                return [];
            }
        },

        // Get QR code by value
        async getByValue(qrValue) {
            try {
                const db = DB._getDB();
                console.log('🔍 Searching for QR code with value:', qrValue);
                const snapshot = await db.collection('qrCodes').where('qrValue', '==', qrValue).limit(1).get();
                console.log('🔍 Query result:', {
                    empty: snapshot.empty,
                    size: snapshot.size,
                    docs: snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
                });
                if (snapshot.empty) {
                    console.log('⚠️ No QR code found with value:', qrValue);
                    // Try to get all QR codes to see what we have
                    const allQRCodes = await db.collection('qrCodes').get();
                    console.log('📋 All QR codes in database:', allQRCodes.docs.map(doc => ({
                        id: doc.id,
                        qrValue: doc.data().qrValue,
                        lotNumber: doc.data().lotNumber,
                        stockNumber: doc.data().stockNumber
                    })));
                    return null;
                }
                const result = DB._docToObject(snapshot.docs[0]);
                console.log('✅ Found QR code:', result);
                return result;
            } catch (error) {
                console.error('❌ Error getting QR code by value:', error);
                console.error('Error details:', {
                    message: error.message,
                    code: error.code,
                    stack: error.stack
                });
                return null;
            }
        },

        // Create QR code record
        async create(data) {
            try {
                const db = DB._getDB();
                const newCode = {
                    qrValue: data.qrValue,
                    lotNumber: data.lotNumber,
                    stockNumber: data.stockNumber,
                    qrUrl: data.qrUrl || null,  // Store QR code URL for printing
                    batchId: data.batchId || null,  // Store batch ID for grouping
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                const docRef = await db.collection('qrCodes').add(newCode);
                const saved = await docRef.get();
                const savedData = DB._docToObject(saved);
                
                console.log('✓ QR code created:', savedData);
                return savedData;
            } catch (error) {
                console.error('Error creating QR code:', error);
                throw new Error('Failed to save QR code: ' + error.message);
            }
        },

        // Update QR code fields by qrValue
        async update(qrValue, data) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('qrCodes').where('qrValue', '==', qrValue).limit(1).get();
                if (snapshot.empty) {
                    return null;
                }
                await snapshot.docs[0].ref.update(data);
                const updated = await snapshot.docs[0].ref.get();
                return DB._docToObject(updated);
            } catch (error) {
                console.error('Error updating QR code:', error);
                throw error;
            }
        }
    },

    // Scan Event Operations
    scanEvents: {
        // Get all scan events
        async getAll() {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('scanEvents').get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting scan events:', error);
                return [];
            }
        },

        // Create scan event
        async create(data) {
            try {
                const db = DB._getDB();
                const newEvent = {
                    qrValue: data.qrValue,
                    action: data.action,
                    childRollId: data.childRollId || null,
                    jobId: data.jobId || null,
                    department: data.department || null,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userAgent: navigator.userAgent
                };
                
                const docRef = await db.collection('scanEvents').add(newEvent);
                const saved = await docRef.get();
                return DB._docToObject(saved);
            } catch (error) {
                console.error('Error creating scan event:', error);
                return null;
            }
        }
    },

    // Helper: Determine QR code stage
    async getQRStage(qrValue) {
        try {
            const masterRoll = await DB.masterRolls.getByQR(qrValue);
            
            if (!masterRoll) {
                const qrCode = await DB.qrCodes.getByValue(qrValue);
                if (qrCode) {
                    return 'stage1';
                }
                return 'not_found';
            }

            // Meter-tracked masters always open the slitting screen (it shows meters left or "used up")
            if (DB.isMeterTracked(masterRoll)) {
                return 'stage2';
            }

            // Old flow below: masters slit once before meter tracking
            if (masterRoll.status === 'registered') {
                const childRolls = await DB.childRolls.getByMasterQR(qrValue);
                if (childRolls.length === 0) {
                    return 'stage2';
                }
            }

            const availableRolls = await DB.childRolls.getAvailableByMasterQR(qrValue);
            if (availableRolls.length === 0) {
                return 'all_used';
            }

            return 'stage3';
        } catch (error) {
            console.error('Error getting QR stage:', error);
            return 'not_found';
        }
    },
    
    // Deleted Stock Numbers Operations
    deletedStockNumbers: {
        // Get all deleted stock numbers
        async getAll() {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('deletedStockNumbers').get();
                return snapshot.docs.map(doc => DB._docToObject(doc));
            } catch (error) {
                console.error('Error getting deleted stock numbers:', error);
                return [];
            }
        },
        
        // Get deleted stock number by stock number
        async getByStockNumber(stockNumber) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('deletedStockNumbers')
                    .where('stockNumber', '==', stockNumber)
                    .limit(1)
                    .get();
                if (snapshot.empty) return null;
                return DB._docToObject(snapshot.docs[0]);
            } catch (error) {
                console.error('Error getting deleted stock number:', error);
                return null;
            }
        },
        
        // Create (move to deleted)
        async create(data) {
            try {
                const db = DB._getDB();
                const deletedStock = {
                    stockNumber: data.stockNumber,
                    originalData: data.originalData, // Store all related data
                    deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    deletedBy: data.deletedBy || 'user'
                };
                
                const docRef = await db.collection('deletedStockNumbers').add(deletedStock);
                const saved = await docRef.get();
                const savedData = DB._docToObject(saved);
                
                console.log('✓ Stock number moved to deleted:', savedData);
                return savedData;
            } catch (error) {
                console.error('Error creating deleted stock number:', error);
                throw new Error('Failed to delete stock number: ' + error.message);
            }
        },
        
        // Restore (delete from deleted collection and restore original data)
        async restore(stockNumber) {
            try {
                const db = DB._getDB();
                const deleted = await this.getByStockNumber(stockNumber);
                if (!deleted) {
                    throw new Error('Deleted stock number not found');
                }
                
                // Restore original data
                if (deleted.originalData) {
                    // Restore master rolls if they existed
                    if (deleted.originalData.masterRolls && deleted.originalData.masterRolls.length > 0) {
                        const batch = db.batch();
                        deleted.originalData.masterRolls.forEach(roll => {
                            const rollRef = db.collection('masterRolls').doc();
                            batch.set(rollRef, roll);
                        });
                        await batch.commit();
                    }
                    
                    // Restore QR codes if they existed
                    if (deleted.originalData.qrCodes && deleted.originalData.qrCodes.length > 0) {
                        const batch = db.batch();
                        deleted.originalData.qrCodes.forEach(qr => {
                            const qrRef = db.collection('qrCodes').doc();
                            batch.set(qrRef, qr);
                        });
                        await batch.commit();
                    }
                }
                
                // Remove from deleted collection
                const snapshot = await db.collection('deletedStockNumbers')
                    .where('stockNumber', '==', stockNumber)
                    .get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                console.log('✓ Stock number restored:', stockNumber);
                return true;
            } catch (error) {
                console.error('Error restoring stock number:', error);
                throw new Error('Failed to restore stock number: ' + error.message);
            }
        },
        
        // Permanently delete (remove from deleted collection)
        async permanentlyDelete(stockNumber) {
            try {
                const db = DB._getDB();
                const snapshot = await db.collection('deletedStockNumbers')
                    .where('stockNumber', '==', stockNumber)
                    .get();
                const batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                
                console.log('✓ Stock number permanently deleted:', stockNumber);
                return true;
            } catch (error) {
                console.error('Error permanently deleting stock number:', error);
                throw new Error('Failed to permanently delete stock number: ' + error.message);
            }
        }
    }
};
