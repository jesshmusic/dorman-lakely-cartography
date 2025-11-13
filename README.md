# Dorman Lakely Cartography

A FoundryVTT module for downloading and managing custom battlemaps with Patreon integration.

## Features

- 🗺️ **Map Gallery** - Browse, search, and filter custom battlemaps
- 🎨 **Tag-Based Filtering** - Organize maps by categories (dungeon, forest, city, etc.)
- 🔐 **Patreon Integration** - OAuth2 authentication with free and premium tiers
- ⚡ **Concurrent Downloads** - Fast parallel file downloads with progress tracking
- 📦 **Scene Compendium** - Pre-configured scenes ready to use
- 💾 **Flexible Storage** - Works with local storage, S3, or any Foundry-supported backend

## Requirements

- **FoundryVTT**: Version 13 or higher
- **Required Modules**:
  - [Tagger](https://github.com/fantasycalendar/FoundryVTT-Tagger) - For entity tagging
  - [Monk's Active Tiles](https://github.com/ironmonk88/monks-active-tiles) - For dynamic tile features

## Installation

### Method 1: Manifest URL
1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste the manifest URL:
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/dorman-lakely-cartography/main/module.json
   ```
4. Click **Install**

### Method 2: Manual Installation
1. Download the [latest release](https://github.com/YOUR_USERNAME/dorman-lakely-cartography/releases)
2. Extract to `[FoundryData]/Data/modules/dorman-lakely-cartography/`
3. Restart Foundry VTT

## Usage

### Opening the Map Gallery
1. Enable the module in your world
2. As a GM, open the **Scenes Directory** (map icon 🗺️ in the left sidebar)
3. Click the **"Dorman Lakely Cartography"** button at the top of the sidebar

### Logging in with Patreon
1. Click **"Login with Patreon"** in the gallery
2. Authorize the application in the popup window
3. Your access level (Free/Premium) will be displayed

### Downloading Maps
1. Browse or search for maps in the gallery
2. Click a map to view details
3. Click **"Download Map"** to start the download
4. Files will be downloaded to your configured path
5. Scenes will be automatically imported

### Configuration
Access module settings in **Configure Settings > Module Settings > Dorman Lakely Cartography**:

- **Download Path** - Custom directory for downloaded files (default: `modules/dorman-lakely-cartography/assets/scenes/`)
- **Concurrent Downloads** - Number of parallel downloads (1-10, default: 5)
- **Cache Expiry** - How long to cache map data in hours (default: 24)

## For Content Creators

This section explains how to set up your own backend API to serve your custom maps.

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│  FoundryVTT │ <──> │   Your API   │ <──> │  Cloudflare R2  │
│   Module    │      │   (Node.js)  │      │  (Map Storage)  │
└─────────────┘      └──────────────┘      └─────────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Patreon    │
                     │    OAuth2    │
                     └──────────────┘
```

### Step 1: Set Up Cloudflare R2 Storage

**Why Cloudflare R2?**
- **Zero egress fees** (free downloads)
- S3-compatible API
- $0.015/GB storage (~$15/TB/month)
- Perfect for serving large map files to patrons

**Setup Steps:**
1. Create a [Cloudflare account](https://dash.cloudflare.com/)
2. Go to **R2 Object Storage**
3. Create a new bucket (e.g., `dorman-lakely-maps`)
4. Set bucket to **Private** (not publicly accessible)
5. Create an API token with R2 read permissions:
   - Go to **R2 > Manage R2 API Tokens**
   - Click **Create API Token**
   - Scope: Read only for your bucket
   - Save the **Access Key ID** and **Secret Access Key**

**Upload Your Maps:**
```bash
# Using AWS CLI (R2 is S3-compatible)
aws s3 cp ./my-map-scene.json s3://dorman-lakely-maps/scenes/map-1/ \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# Or use Cloudflare's dashboard to upload via UI
```

**Organize your files like this:**
```
dorman-lakely-maps/
├── scenes/
│   ├── dungeon-depths/
│   │   ├── scene.json
│   │   ├── background.webp
│   │   ├── tiles/
│   │   └── thumbnails/
│   ├── forest-clearing/
│   └── castle-throne-room/
└── metadata/
    ├── maps.json (map catalog)
    └── tags.json (tag list)
```

### Step 2: Set Up Your API Server

You'll need a Node.js API server that:
1. Serves map catalog and tags
2. Handles Patreon OAuth2 authentication
3. Proxies/serves files from R2 with authorization checks

**Required API Endpoints:**
- `GET /api/v1/maps/tags` - List all tags
- `GET /api/v1/maps/list` - Map catalog
- `GET /api/v1/maps/files/:mapId` - File manifest for a map (requires auth)
- `POST /api/v1/maps/file/:mapId` - Download file (requires auth)
- `GET /api/v1/users/:userId/ready` - Check auth status
- `GET /api/v1/patreon/callback` - OAuth2 callback handler

**Example Tech Stack:**
- **Runtime**: Node.js 20+
- **Framework**: Express, Fastify, or Hono
- **Database**: PostgreSQL or SQLite (for user sessions)
- **SDK**: AWS SDK (for R2 access)

**Sample Code Snippet** (Express + AWS SDK):
```javascript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Generate signed URL for file download
app.post('/api/v1/maps/file/:mapId', authenticate, async (req, res) => {
  const { mapId } = req.params;
  const { path } = req.body;
  const user = req.user; // From auth middleware

  // Check access level
  const map = await getMap(mapId);
  if (map.access === 'Premium' && !user.has_premium) {
    return res.status(403).json({ error: 'Premium access required' });
  }

  // Generate signed URL (valid for 1 hour)
  const command = new GetObjectCommand({
    Bucket: 'dorman-lakely-maps',
    Key: path
  });

  const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

  // Option 1: Return signed URL for direct download
  res.json({ url: signedUrl });

  // Option 2: Proxy the file through your server (more control)
  // const response = await fetch(signedUrl);
  // res.setHeader('Content-Type', response.headers.get('content-type'));
  // response.body.pipe(res);
});
```

### Step 3: Set Up Patreon OAuth2

1. Go to [Patreon Developers](https://www.patreon.com/portal/registration/register-clients)
2. Create a new client
3. Set redirect URI: `https://your-api.com/api/v1/patreon/callback`
4. Copy your **Client ID** and **Client Secret**
5. Request scopes: `identity`, `identity.memberships`

**OAuth Flow:**
1. Module opens Patreon auth URL with `state` parameter (user ID)
2. User authorizes on Patreon
3. Patreon redirects to your callback with `code` and `state`
4. Your API exchanges `code` for access token
5. Fetch user's membership tier from Patreon API
6. Store user session with tier info (has_free, has_premium)
7. Module polls `/users/:userId/ready` until authenticated

**Sample Patreon API Call:**
```javascript
// Exchange code for token
const tokenResponse = await fetch('https://www.patreon.com/api/oauth2/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code: req.query.code,
    grant_type: 'authorization_code',
    client_id: process.env.PATREON_CLIENT_ID,
    client_secret: process.env.PATREON_CLIENT_SECRET,
    redirect_uri: process.env.PATREON_REDIRECT_URI
  })
});

const { access_token } = await tokenResponse.json();

// Fetch user memberships
const membershipResponse = await fetch(
  'https://www.patreon.com/api/oauth2/v2/identity?include=memberships&fields[member]=patron_status,currently_entitled_amount_cents',
  { headers: { Authorization: `Bearer ${access_token}` } }
);

const data = await membershipResponse.json();

// Determine tier
const membership = data.included?.find(i => i.type === 'member');
const tierCents = membership?.attributes?.currently_entitled_amount_cents || 0;

const user = {
  userId: req.query.state, // From OAuth state parameter
  has_free: tierCents >= 0,
  has_premium: tierCents >= 500, // $5+ tier
  expires_in: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
};

// Save to database
await saveUserSession(user);
```

### Step 4: Configure the Module

Update your deployed module's `module.json` with your API details:
```json
{
  "apiConfig": {
    "baseUrl": "https://your-api.com",
    "patreonClientId": "YOUR_PATREON_CLIENT_ID",
    "patreonRedirectUri": "https://your-api.com/api/v1/patreon/callback"
  }
}
```

Or set it via game settings in your API on first load.

### Deployment Recommendations

**API Hosting:**
- [Railway](https://railway.app/) - Easy Node.js deployments
- [Fly.io](https://fly.io/) - Global edge network
- [Render](https://render.com/) - Simple platform
- [AWS Lambda](https://aws.amazon.com/lambda/) - Serverless option

**Database:**
- [Supabase](https://supabase.com/) - PostgreSQL + auth
- [PlanetScale](https://planetscale.com/) - MySQL
- [Turso](https://turso.tech/) - SQLite at the edge

**Cost Estimate** (for ~100 active patrons):
- Cloudflare R2: $15-30/month (storage)
- API Hosting: $5-20/month
- Database: $0-10/month
- **Total: $20-60/month**

## Development

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env

# Edit .env with your values:
# - VITE_API_BASE_URL: Your backend API URL (http://localhost:3000 for dev)
# - VITE_PATREON_CLIENT_ID: Your Patreon OAuth Client ID
# - VITE_PATREON_REDIRECT_URI: OAuth callback URL

# Build the module
npm run build

# Watch for changes
npm run watch

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Environment Variables

The module requires the following environment variables for development:

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API endpoint | `http://localhost:3000` (dev)<br/>`https://yourdomain.com` (prod) |
| `VITE_PATREON_CLIENT_ID` | Patreon OAuth Client ID | Get from [Patreon Developers](https://www.patreon.com/portal) |
| `VITE_PATREON_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/v1/patreon/callback` (dev) |

**Setup:**
1. Copy `.env.example` to `.env`
2. Get your Patreon credentials from [Patreon Developer Portal](https://www.patreon.com/portal/registration/register-clients)
3. Update the values in `.env`
4. Rebuild the module with `npm run build`

**Note:** The `.env` file is gitignored and should never be committed. These values get injected into the module at build time and become the default configuration.

### Project Structure
```
dorman-lakely-cartography/
├── src/
│   ├── main.ts                 # Entry point with Foundry hooks
│   ├── services/               # Core services
│   │   ├── api-service.ts      # HTTP communication
│   │   ├── patreon-auth-service.ts
│   │   ├── file-upload-service.ts
│   │   └── concurrent-download-manager.ts
│   ├── ui/                     # UI components (ApplicationV2)
│   │   ├── map-gallery-dialog.ts
│   │   └── download-dialog.ts
│   ├── types/                  # TypeScript definitions
│   │   ├── foundry.d.ts
│   │   └── module.ts
│   └── utils/                  # Helper utilities
├── templates/                  # Handlebars templates
│   ├── gallery.hbs
│   └── download.hbs
├── styles/                     # CSS files
│   └── main.css
├── lang/                       # Localization
│   └── en.json
├── packs/                      # Compendium packs
│   ├── maps/                   # LevelDB (generated)
│   └── _source/                # JSON source files
├── tests/                      # Jest tests
│   ├── services/
│   ├── ui/
│   └── setup.ts
├── scripts/                    # Build scripts
│   └── release.js
├── utils/                      # Pack utilities
│   └── packs.mjs
└── .github/workflows/          # CI/CD
    ├── test.yml
    └── release.yml
```

### Building Releases
```bash
# Bump version (patch/minor/major)
npm run release:patch

# Commit and push
git add -A
git commit -m "chore: bump version to X.X.X"
git push

# Trigger release workflow in GitHub Actions
# (Manually from Actions tab)
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run lint` and `npm test`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Credits

- **Created by**: Dorman Lakely
- **Built with**: TypeScript, Vite, Jest
- **Inspired by**: [Forgotten Adventures Battlemaps](https://github.com/Forgotten-Adventures/FA_Battlemaps)

## Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/dorman-lakely-cartography/issues)
- **Patreon**: [Support on Patreon](https://patreon.com/YOUR_PATREON_USERNAME)
- **Discord**: [Join our Discord](https://discord.gg/YOUR_DISCORD_INVITE)

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.
