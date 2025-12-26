// Firebase Configuration and Initialization
const firebaseConfig = {
  apiKey: "AIzaSyAFP9Wty10DiIEw8mJmroJrfS7Hs01iqEk",
  authDomain: "rbd-mrt.firebaseapp.com",
  projectId: "rbd-mrt",
  storageBucket: "rbd-mrt.firebasestorage.app",
  messagingSenderId: "1001537252022",
  appId: "1:1001537252022:web:267b3c5a7278e3c8c11417",
  measurementId: "G-E6S1N0ZKEW"
};

// Initialize Firebase and Firestore
let db = null;
let auth = null;
let firebaseInitialized = false;

// Initialize Firebase and Firestore
function initializeFirebase() {
    if (firebaseInitialized && db && auth) {
        console.log('✓ Using existing Firebase instance');
        return { db, auth };
    }
    
    try {
        console.log('🔧 Initializing Firebase...');
        // Check if Firebase is already initialized
        let app;
        try {
            app = firebase.app();
            console.log('✓ Using existing Firebase app');
        } catch (e) {
            // Firebase not initialized, initialize it
            app = firebase.initializeApp(firebaseConfig);
            console.log('✓ Created new Firebase app');
        }
        
        // Initialize Firestore
        db = firebase.firestore();
        
        // Initialize Auth
        auth = firebase.auth();
        
        firebaseInitialized = true;
        
        // Enable offline persistence (optional, but helpful)
        // db.enablePersistence().catch(err => {
        //     console.warn('Could not enable offline persistence:', err);
        // });
        
        console.log('✓ Firebase Firestore and Auth initialized successfully');
        console.log('📊 Firestore instance:', db);
        return { db, auth };
    } catch (error) {
        console.error('❌ Error initializing Firebase:', error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
}

// Get Firestore instance
function getFirestore() {
    if (!firebaseInitialized) {
        initializeFirebase();
    }
    return db;
}

// Get Auth instance
function getAuth() {
    if (!firebaseInitialized) {
        initializeFirebase();
    }
    return auth;
}

