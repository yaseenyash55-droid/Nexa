export interface ApprovedDocItem {
  source: string;
  title: string;
  category: string;
  content: string;
}

export const APPROVED_NEXA_DOCUMENTATION: ApprovedDocItem[] = [
  {
    source: 'user_manual_getting_started',
    title: '1. Getting Started & Account Setup',
    category: 'account',
    content: `Learn how to create an account, log in securely, and start using NEXA.
Step 1: Account Registration - Click "Sign up" on the login screen, enter your username, email, and password, then submit to register.
Step 2: Session Authentication - Log in with your registered username or email. JWT access tokens (15-min expiry) and HTTP-only refresh tokens will be stored securely.
Step 3: User Dashboard Navigation - Use the left sidebar navigation (or bottom navigation bar on mobile) to access Home Feed, Explore, Messages, User Manual, Profile, and Settings.`
  },
  {
    source: 'user_manual_profile_uploads',
    title: '2. Instagram-Style Profile Photo & Banner Uploads',
    category: 'profile',
    content: `Upload profile photos and cover banners using FormData file streaming and instant previews.
Step 1: Open Edit Profile Modal - Navigate to your Profile page and click the "Edit Profile" button to launch the Instagram-style profile editor.
Step 2: Change Profile Photo - Hover over the circular avatar card and click "Change Photo". Pick a 1:1 square image (JPEG/PNG/WebP). An instant circular preview will display.
Step 3: Change Cover Banner - Hover over the wide cover banner area and click "Change Banner". Select a wide image (3:1 or 16:9 ratio).
Step 4: Save Changes - Click Save to update your profile in Oracle Database.`
  },
  {
    source: 'user_manual_messaging_e2ee',
    title: '3. Realtime Direct Messaging & End-to-End Encryption',
    category: 'messaging',
    content: `NEXA provides realtime direct messaging with WebSocket Socket.IO delivery, WebRTC 1-on-1 audio/video calls, and end-to-end encryption (E2EE) security.
Direct messages, group chats, and broadcast channels are supported.
Messages can include photos, videos, and GIF attachments.
E2EE ensures that direct messages are encrypted on the client before being sent across the network.`
  },
  {
    source: 'user_manual_nexa_ai',
    title: '4. NEXA AI Assistant & Post Writing',
    category: 'ai_assistant',
    content: `NEXA AI is the built-in intelligent assistant on NEXA Social Network.
Key capabilities:
- Interactive multi-turn chat via /ai with Server-Sent Events (SSE) streaming responses.
- Post Writing Assistant in Post Composer: Generate Captions, Improve Writing, Fix Grammar, Shorten, Make Professional, Make Casual, Generate Hashtags, and Translate.
- User control: Post writing assistant outputs a preview. Users must explicitly click "Accept & Replace Draft" or "Discard". AI never automatically publishes posts.`
  },
  {
    source: 'user_manual_privacy_protection',
    title: '5. Privacy Settings & Account Protection Center',
    category: 'privacy_security',
    content: `NEXA offers comprehensive privacy and protection controls:
- Account Privacy: Public vs Private profile toggles.
- Messaging Privacy: Control who can message you (Everyone, Following Only, or Nobody).
- Protection Center: Manage two-factor authentication (2FA) via email OTP, view recent security audit logs, block or report abusive users, and manage active sessions.`
  },
  {
    source: 'nexa_faq',
    title: '6. Frequently Asked Questions (FAQ)',
    category: 'faq',
    content: `Q: Is NEXA free to use?
A: Yes, NEXA is completely free to use for personal social networking, sharing stories, bytes, and messaging.
Q: How are passwords stored?
A: Passwords are encrypted with salted bcrypt hashing (cost factor 10+) and never logged or stored in plain text.
Q: How does NEXA handle media uploads?
A: Images and videos are processed with chunked/resumable upload streaming and stored safely in structured storage.`
  }
];
