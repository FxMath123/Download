# 📥 GitHub File Downloader

A 100% **GitHub Pages** file downloader that accepts any file URL, downloads it via **GitHub Actions**, stores it in the repository, and generates a permanent **raw download link**.

## 🚀 Features

- ✅ **Download any file** - Paste any HTTP/HTTPS URL and trigger a download
- ✅ **GitHub Actions powered** - No backend server needed, 100% serverless
- ✅ **Automatic filename detection** - Extracts filename from URL automatically
- ✅ **Custom filenames** - Optionally specify your own filename
- ✅ **Permanent raw links** - Get `raw.githubusercontent.com` links for direct access
- ✅ **Download history** - View all previously downloaded files
- ✅ **Copy raw URLs** - One-click copy to clipboard
- ✅ **Dark mode UI** - GitHub-inspired dark theme
- ✅ **Mobile responsive** - Works on all devices
- ✅ **100% free** - Uses GitHub's free tier (GitHub Actions + GitHub Pages)

## 🎯 How It Works

```
User submits URL → GitHub Pages (Frontend) 
→ Triggers GitHub Actions API 
→ Workflow downloads the file using curl 
→ Commits file to repository 
→ Generates raw.githubusercontent.com link
```

## 📋 Setup Instructions

### Prerequisites
- A GitHub account
- A repository (public or private)

### Step 1: Create the Repository

```bash
# Clone the template or create a new repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### Step 2: Add Files to Your Repository

Copy the following files into your repository:

```
.
├── index.html              # Main page (GitHub Pages)
├── README.md               # This documentation
├── .github/
│   └── workflows/
│       └── download.yml    # GitHub Actions workflow
├── assets/
│   ├── css/
│   │   └── style.css       # Styles
│   └── js/
│       └── app.js          # Frontend logic
└── downloads/              # Downloaded files stored here
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under "Source", select **Deploy from a branch**
4. Choose **main** (or your default branch) and **/(root)**
5. Click **Save**

### Step 4: Enable GitHub Actions

GitHub Actions is enabled by default. Make sure workflows have **read and write permissions**:

1. Go to **Settings** → **Actions** → **General**
2. Under "Workflow permissions", select **Read and write permissions**
3. Click **Save**

### Step 5: Enable GitHub Actions (Alternative - PAT Token)

If you need a Personal Access Token for API operations:

1. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Generate a token with `actions:write` and `contents:write` permissions
3. Go to your repo **Settings** → **Secrets and variables** → **Actions**
4. Add a new secret named `GITHUB_TOKEN` with the token value

## 🖥️ Usage

### Via the Web Interface

1. Open your GitHub Pages site: `https://YOUR_USERNAME.github.io/YOUR_REPO/`
2. Enter the URL of the file you want to download
3. (Optional) Enter a custom filename
4. Click **Start Download**
5. Wait for the workflow to complete
6. Copy the raw download link

### Via GitHub Actions Directly

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. Select **File Downloader** from the left sidebar
4. Click **Run workflow**
5. Enter the file URL and optional custom filename
6. Click **Run workflow**

### Workflow Input Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `file_url` | ✅ Yes | The full URL of the file to download |
| `custom_filename` | ❌ No | Override the auto-detected filename |

## 🔗 URL Structure

After a successful download, you'll get:

```
Raw URL:     https://raw.githubusercontent.com/USER/REPO/BRANCH/downloads/FILENAME
GitHub URL:  https://github.com/USER/REPO/blob/BRANCH/downloads/FILENAME
```

Example:
```
https://raw.githubusercontent.com/username/my-repo/main/downloads/20240101_120000_image.jpg
```

## 🛡️ Security & Limitations

### Limitations
- **File size**: GitHub Actions has a 6-hour execution limit. Files up to ~2GB can be downloaded.
- **Commit size**: GitHub recommends files under 100MB per commit (configurable with Git LFS).
- **Rate limits**: GitHub API has rate limits (60 req/hour for unauthenticated, 5000 req/hour authenticated).
- **Public URLs only**: Can only download from publicly accessible URLs.

### Security Notes
- Only download files from trusted sources
- The workflow runs in an isolated GitHub Actions environment
- Downloaded files are stored in your repository
- GitHub scans all commits for secrets and tokens

## 🧪 Testing

To test locally, you can serve the frontend:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000` in your browser.

## 📁 Downloaded Files

All downloaded files are stored in the `downloads/` directory at the root of your repository. Each download also creates a `download_info.json` metadata file:

```json
{
  "filename": "20250101_120000_example.zip",
  "source_url": "https://example.com/file.zip",
  "size_bytes": 1234567,
  "mime_type": "application/zip",
  "downloaded_at": "2026-01-01T12:00:00Z",
  "raw_url": "https://raw.githubusercontent.com/.../.../downloads/example.zip",
  "workflow_run": 1234567890
}
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-idea`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-idea`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Built with [GitHub Actions](https://github.com/features/actions)
- Hosted on [GitHub Pages](https://pages.github.com/)
- Inspired by the need for a simple, free file hosting solution
