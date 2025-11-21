# Deploy Firestore Security Rules

## Important: You MUST deploy the security rules to Firebase for reads to work!

The `firestore.rules` file exists in your project, but it needs to be deployed to Firebase for the rules to take effect.

## Option 1: Deploy via Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **RBD MRT**
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab at the top
5. Copy and paste the contents of `firestore.rules` into the editor:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read/write access for all collections
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. Click **Publish** button
7. Wait for the deployment to complete (you'll see a success message)

## Option 2: Deploy via Firebase CLI

If you have Firebase CLI installed:

```bash
firebase deploy --only firestore:rules
```

## Verify Rules Are Active

After deploying:
1. Go back to Firestore Database → Rules tab
2. You should see your rules displayed
3. The rules should show "Published" status

## Test

After deploying the rules:
1. Refresh your web app
2. Try accessing the Inventory page
3. Try marking a master roll as received
4. Check the browser console (F12) for any permission errors

If you still see permission errors after deploying, check:
- The rules syntax is correct
- You're using the correct Firebase project
- The browser console for specific error messages

