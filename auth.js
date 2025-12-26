// Authentication and User Management
const Auth = {
    // Sign in with email and password
    async signIn(email, password) {
        try {
            const auth = getAuth();
            if (!auth) {
                throw new Error('Firebase Auth not initialized');
            }

            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            console.log('✓ User signed in:', userCredential.user.email);

            // Ensure user role document exists
            await this.ensureUserRole(userCredential.user.uid, email);

            return userCredential.user;
        } catch (error) {
            console.error('Sign in error:', error);
            let errorMessage = 'Failed to sign in. ';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage += 'User not found.';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage += 'Incorrect password.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage += 'Invalid email address.';
            } else if (error.code === 'auth/user-disabled') {
                errorMessage += 'User account has been disabled.';
            } else {
                errorMessage += error.message;
            }
            
            throw new Error(errorMessage);
        }
    },

    // Sign out
    async signOut() {
        try {
            const auth = getAuth();
            if (!auth) {
                return;
            }

            await auth.signOut();
            console.log('✓ User signed out');
            
            // Redirect to login page
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Sign out error:', error);
            throw error;
        }
    },

    // Get current user
    async getCurrentUser() {
        try {
            const auth = getAuth();
            if (!auth) {
                return null;
            }

            return new Promise((resolve) => {
                auth.onAuthStateChanged((user) => {
                    resolve(user);
                });
            });
        } catch (error) {
            console.error('Get current user error:', error);
            return null;
        }
    },

    // Get user role from Firestore
    async getUserRole() {
        try {
            const user = await this.getCurrentUser();
            if (!user) {
                return null;
            }

            const db = getFirestore();
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                return null;
            }

            return userDoc.data().role || null;
        } catch (error) {
            console.error('Get user role error:', error);
            return null;
        }
    },

    // Ensure user role document exists (create if it doesn't)
    async ensureUserRole(uid, email) {
        try {
            const db = getFirestore();
            const userRef = db.collection('users').doc(uid);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                // First time login - check if this is the admin email
                let role = 'viewer'; // default role
                
                if (email === 'andrein@rbdpack.com') {
                    role = 'admin';
                }

                // Create user document with role
                await userRef.set({
                    email: email,
                    role: role,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });

                console.log(`✓ Created user role document for ${email} with role: ${role}`);
            } else {
                // Update last login
                await userRef.update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Ensure user role error:', error);
            throw error;
        }
    },

    // Check if user has required role
    async hasRole(requiredRole) {
        const userRole = await this.getUserRole();
        if (!userRole) {
            return false;
        }

        // Admin has access to everything
        if (userRole === 'admin') {
            return true;
        }

        // Check specific role
        return userRole === requiredRole;
    },

    // Check if user is admin
    async isAdmin() {
        return await this.hasRole('admin');
    },

    // Require authentication (redirect to login if not authenticated)
    async requireAuth() {
        const user = await this.getCurrentUser();
        if (!user) {
            // Store the current page to redirect back after login
            const currentPath = window.location.pathname + window.location.search;
            sessionStorage.setItem('redirectAfterLogin', currentPath);
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    // Require specific role (redirect to login or show error)
    async requireRole(requiredRole) {
        const authenticated = await this.requireAuth();
        if (!authenticated) {
            return false;
        }

        const hasRole = await this.hasRole(requiredRole);
        if (!hasRole) {
            alert(`Access denied. This page requires ${requiredRole} role.`);
            window.location.href = 'index.html';
            return false;
        }

        return true;
    },

    // Get user info (email, role, etc.)
    async getUserInfo() {
        const user = await this.getCurrentUser();
        if (!user) {
            return null;
        }

        const role = await this.getUserRole();
        return {
            uid: user.uid,
            email: user.email,
            role: role
        };
    }
};

