// Firestore Database Management
// This file handles all database operations using Firebase Firestore

const DB = {
    storageType: 'firestore',
    
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
                const batch = db.batch();
                const timestamp = Date.now();
                const newRolls = [];
                
                widths.forEach((width, index) => {
                    const rollData = {
                        masterRollQR: masterRollQR,
                        width: width,
                        status: 'AVAILABLE',
                        jobId: jobId || `job-${timestamp}`,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    const docRef = db.collection('childRolls').doc(`${timestamp}-${index}`);
                    batch.set(docRef, rollData);
                    newRolls.push({ id: docRef.id, ...rollData });
                });
                
                await batch.commit();
                console.log(`✓ Created ${newRolls.length} child rolls`);
                return newRolls;
            } catch (error) {
                console.error('Error creating child rolls:', error);
                throw new Error('Failed to save child rolls: ' + error.message);
            }
        },

        // Mark a child roll as used
        async markAsUsed(childRollId) {
            try {
                const db = DB._getDB();
                const docRef = db.collection('childRolls').doc(childRollId);
                await docRef.update({
                    status: 'USED',
                    usedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                const updated = await docRef.get();
                return DB._docToObject(updated);
            } catch (error) {
                console.error('Error marking child roll as used:', error);
                return null;
            }
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
    }
};
