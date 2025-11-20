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
let firebaseInitialized = false;

// Initialize Firebase and Firestore
function initializeFirebase() {
    if (firebaseInitialized && db) {
        return db;
    }
    
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        
        // Initialize Firestore
        db = firebase.firestore();
        firebaseInitialized = true;
        
        console.log('✓ Firebase Firestore initialized successfully');
        return db;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        throw error;
    }
}

// Get Firestore instance
function getFirestore() {
    if (!firebaseInitialized) {
        return initializeFirebase();
    }
    return db;
}

