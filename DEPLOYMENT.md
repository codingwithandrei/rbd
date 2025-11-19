# Deployment Guide - Vercel + GitHub

This guide will help you deploy the RBD Master Roll Application to Vercel using GitHub.

## Prerequisites

- A GitHub account
- A Vercel account (free tier works)
- Git installed on your computer

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right, then "New repository"
3. Name your repository (e.g., `rbd-master-roll-app`)
4. Choose Public or Private
5. **Don't** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Push Code to GitHub

Open your terminal/command prompt in the project directory and run:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit - RBD Master Roll App"

# Add your GitHub repository as remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Vercel

1. Go to [Vercel](https://vercel.com) and sign in
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Vercel will auto-detect settings:
   - **Framework Preset**: Other
   - **Build Command**: (leave empty - no build needed)
   - **Output Directory**: (leave empty - root directory)
5. Click "Deploy"
6. Wait for deployment to complete (usually 1-2 minutes)
7. Your app will be live! Vercel will provide a URL like `https://your-project.vercel.app`

## Step 4: Update QR Code URLs (Important!)

After deployment, you need to update the QR code generation to use your Vercel URL:

1. Go to your Vercel project dashboard
2. Copy your deployment URL (e.g., `https://your-project.vercel.app`)
3. Open `generate-qr.js` in your code editor
4. Find the line that creates the QR code URL (around line 107)
5. Update it to use your Vercel URL:

```javascript
// Change from:
const qrData = `index.html?qr=${encodeURIComponent(qrValue)}&lot=...`;

// To:
const qrData = `https://your-project.vercel.app/index.html?qr=${encodeURIComponent(qrValue)}&lot=...`;
```

6. Commit and push the change:
```bash
git add generate-qr.js
git commit -m "Update QR codes to use Vercel URL"
git push
```

7. Vercel will automatically redeploy with the new URL

## Continuous Deployment

Once set up, every time you push to GitHub:
- Vercel automatically detects the changes
- Builds and deploys your app
- Your live site updates automatically

## Custom Domain (Optional)

1. In Vercel dashboard, go to your project → Settings → Domains
2. Add your custom domain
3. Follow Vercel's instructions to configure DNS

## Environment Variables (If Needed Later)

If you add backend features later:
1. Go to Vercel project → Settings → Environment Variables
2. Add any API keys or secrets
3. Redeploy for changes to take effect

## Troubleshooting

### QR Codes not working after deployment
- Make sure you updated `generate-qr.js` with your Vercel URL
- Check that the URL in QR codes matches your deployment URL

### localStorage not persisting
- localStorage works per domain/browser
- Each user's data is stored in their browser
- This is expected behavior for client-side storage

### Build errors
- This is a static site, so there shouldn't be build errors
- If you see errors, check the Vercel deployment logs

## Support

- Vercel Docs: https://vercel.com/docs
- GitHub Docs: https://docs.github.com

