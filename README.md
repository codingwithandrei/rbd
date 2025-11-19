# RBD Master Roll Application

A QR code-based manufacturing management system for tracking master rolls and job assignments with a complete 3-stage lifecycle.

## Features

- **3-Stage QR Code Lifecycle**:
  - **Stage 1**: Master Roll Registration (first scan)
  - **Stage 2**: Job Assignment/Slitting (second scan - create child rolls)
  - **Stage 3**: Roll Selection (subsequent scans - select available rolls to use)
- **Master Roll Registration**: Register new master rolls with stock and lot numbers
- **Job Assignment**: Split master rolls into production rolls with size validation
- **Generate QR Codes**: Create QR codes with lot and stock numbers
- **Roll Selection**: Select from available child rolls and mark as used
- **Validation**: Ensures total roll sizes don't exceed 1300mm limit
- **Local Database**: Complete database structure using localStorage for testing

## Getting Started

### Running Locally

1. Simply open `index.html` in your web browser
2. No server or build process required - works as static HTML files
3. All data is stored in browser's localStorage

### Deploying to Vercel

1. Push your code to a GitHub repository
2. Go to [Vercel](https://vercel.com) and sign in with GitHub
3. Click "New Project" and import your repository
4. Vercel will auto-detect it as a static site
5. Click "Deploy" - no build settings needed
6. Your app will be live at `https://your-project.vercel.app`

**Note**: Since this app uses localStorage, each user's data is stored in their browser. For production use, consider migrating to a backend database.

### File Structure

```
├── index.html              # Landing page (with QR stage detection)
├── master-roll.html        # Master Roll Registration page (Stage 1)
├── job-assignment.html     # Job Assignment page (Stage 2)
├── select-roll.html        # Roll Selection page (Stage 3)
├── generate-qr.html        # QR Code Generation page
├── view-qr.html            # QR Code Information display page
├── styles.css              # Global styles
├── database.js             # Database management and utilities
├── app.js                  # Shared JavaScript utilities
├── master-roll.js          # Master Roll functionality (Stage 1)
├── job-assignment.js       # Job Assignment functionality (Stage 2)
├── select-roll.js          # Roll Selection functionality (Stage 3)
├── generate-qr.js          # QR Code generation functionality
├── view-qr.js              # QR Code viewing functionality
└── README.md              # This file
```

## Usage

### QR Code Lifecycle

The application follows a 3-stage lifecycle for each QR code:

#### Stage 1 - Master Roll Registration (First Scan)
1. Generate a QR code with lot and stock numbers
2. Scan the QR code - automatically routes to Master Roll Registration
3. Confirm stock and lot numbers
4. Master roll is registered in the database (status: "registered")

#### Stage 2 - Job Assignment/Slitting (Second Scan)
1. Scan the same QR code again
2. System detects master roll is registered but not yet slit
3. Enter number of rolls to create from the master roll
4. For each roll, select size (225mm, 241mm, 325mm, or Custom)
5. System validates total doesn't exceed 1300mm
6. Child rolls are created (status: "AVAILABLE")
7. Master roll status changes to "slit"

#### Stage 3 - Roll Selection (Subsequent Scans)
1. Scan the QR code again
2. System shows list of available child rolls
3. Select a roll to mark as used
4. Selected roll status changes to "USED"
5. Used rolls no longer appear in the list
6. When all rolls are used, system shows "All Rolls Used" message

### Generate QR Codes

1. Click "Generate QR Codes" on the landing page
2. Enter the number of QR codes you want to generate
3. For each QR code, enter Lot Number and Stock Number
4. Click "Generate QR Codes" to create and display the QR codes
5. QR codes can be printed using the "Print QR Codes" button
6. QR codes are automatically stored in the database
7. When scanned, QR codes automatically route to the appropriate stage

### Manual Navigation

You can also manually navigate to:
- **Master Roll Registration**: For testing or manual entry
- **Job Assignment**: For testing slitting functionality
- **Select Roll**: To view and select available rolls

## Design

- Modern, professional design with white, yellow, and blue color scheme
- Responsive layout that works on desktop and mobile
- Clean, intuitive user interface

## Browser Compatibility

Works in all modern browsers that support:
- ES6 JavaScript
- localStorage API
- CSS Grid and Flexbox

## Database Structure

The application uses a local database (localStorage) with the following structure:

- **masterRolls**: Master roll records with QR value, stock/lot numbers, and status
- **childRolls**: Child roll records linked to master rolls with width and status
- **qrCodes**: QR code records with lot and stock numbers
- **scanEvents**: Event log of all QR code scans and actions

### Database Operations

All database operations are handled through `database.js`:
- `DB.masterRolls.*` - Master roll operations
- `DB.childRolls.*` - Child roll operations
- `DB.qrCodes.*` - QR code operations
- `DB.scanEvents.*` - Scan event logging
- `DB.getQRStage(qrValue)` - Determines which stage a QR code is in

## QR Code Usage

### For Local Testing
When testing locally, QR codes will use relative URLs. For best results:
1. Use a local web server (e.g., `python -m http.server` or `npx serve`)
2. Access the app via `http://localhost:port` instead of `file://`
3. Generated QR codes will work properly when scanned
4. QR codes automatically route to the correct stage based on database state

### For Production
Update the QR code generation in `generate-qr.js` to use your production URL:
```javascript
const qrData = `https://yourdomain.com/index.html?qr=...&lot=...&stock=...`;
```

## Next Steps

- Connect to a backend database
- Implement user authentication
- Add reporting and analytics features
- Add QR code history and tracking

