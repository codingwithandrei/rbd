# Authentication Setup Guide

## ✅ What Has Been Implemented

1. **Login Page** (`login.html`) - Email/password authentication
2. **Authentication Module** (`auth.js`) - Handles sign in, sign out, role checking
3. **Firebase Auth Integration** - Updated `firebase-config.js` to include Auth
4. **Security Rules** (`firestore.rules`) - Protects your database with role-based access
5. **Page Protection** - All admin pages require authentication
6. **QR Scanning** - Works without login (read-only access to specific QR data)

## 🔧 Setup Steps in Firebase Console

### Step 1: Enable Authentication

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **RBD MRT**
3. Click on **Authentication** in the left sidebar
4. Click **Get Started** (if first time) or go to **Sign-in method** tab
5. Enable **Email/Password** provider:
   - Click on "Email/Password"
   - Toggle "Enable" to ON
   - Click **Save**

### Step 2: Create Admin User

1. In Firebase Console, go to **Authentication** → **Users** tab
2. Click **Add user** button
3. Enter:
   - **Email**: `andrein@rbdpack.com`
   - **Password**: `550crow`
4. Click **Add user**

### Step 3: Deploy Security Rules

**IMPORTANT**: You must deploy the security rules before the app will work!

#### Option A: Deploy via Firebase Console (Easiest)

1. Go to **Firestore Database** → **Rules** tab
2. Copy the entire contents of `firestore.rules` file
3. Paste into the rules editor in Firebase Console
4. Click **Publish** button
5. Wait for deployment to complete

#### Option B: Deploy via Firebase CLI

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

## 🎯 How It Works

### Authentication Flow

1. **Unauthenticated Users**:
   - Can scan QR codes and view that specific QR's data
   - Cannot access admin pages (redirected to login)
   - Cannot write to database

2. **Authenticated Users**:
   - Full access to all pages
   - Can read all data
   - Can write based on role (admin/operator)

### Role System

- **Admin** (`andrein@rbdpack.com`): Full access to everything
- **Operator**: Can create/update records (future use)
- **Viewer**: Read-only access (future use)

The role is automatically assigned when a user first logs in:
- `andrein@rbdpack.com` → `admin` role
- All other users → `viewer` role (default)

### QR Scanning Without Login

QR scanning pages work without authentication:
- `master-roll.html` - Can mark master roll as received
- `job-assignment.html` - Can assign jobs
- `select-roll.html` - Can select rolls
- `view-qr.html` - Can view QR info

These pages can read/write data for the specific QR code being scanned, but cannot browse all data.

## 📝 Testing

1. **Test Login**:
   - Go to `login.html`
   - Sign in with `andrein@rbdpack.com` / `550crow`
   - Should redirect to `index.html`
   - Should see your email and role in the header

2. **Test QR Scanning**:
   - Open `index.html?qr=YOUR_QR_VALUE` (without logging in)
   - Should work and route to appropriate page

3. **Test Protected Pages**:
   - Sign out
   - Try to access `generate-qr.html` directly
   - Should redirect to `login.html`

## 🔒 Security Rules Summary

- **Read Access**: 
  - Unauthenticated: Can read QR codes, master rolls, child rolls, scan events
  - Authenticated: Can read everything
  
- **Write Access**:
  - Unauthenticated: Can only create scan events
  - Authenticated: Can create/update based on role
  - Admin only: Can delete records

## 🚨 Important Notes

1. **Deploy Rules First**: The app won't work until you deploy the security rules!
2. **Create User First**: Make sure to create the admin user in Firebase Console before testing
3. **Test Mode Expiry**: Your Firestore test mode will expire after 30 days. Once you deploy these rules, they replace test mode.

## 🐛 Troubleshooting

**"Permission denied" errors**:
- Make sure you deployed the security rules
- Check that the user exists in Firebase Authentication
- Verify the user has a role document in Firestore `users` collection

**"User not found" on login**:
- Make sure you created the user in Firebase Console
- Check the email is exactly `andrein@rbdpack.com`

**QR scanning not working**:
- Check that security rules are deployed
- Verify the QR code exists in the database

## 📞 Next Steps

After setup:
1. Test login functionality
2. Test QR scanning without login
3. Test protected pages
4. Create additional users as needed (they'll get `viewer` role by default)
5. To change a user's role, update the `users/{userId}` document in Firestore with `role: 'admin'` or `role: 'operator'`

