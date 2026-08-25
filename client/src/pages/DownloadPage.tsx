import React from 'react';
import { Download, Smartphone, ShieldCheck, Video, Bell, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell.js';
import { ANDROID_RELEASE } from '../config/androidRelease.js';

export const DownloadPage: React.FC = () => {
  return (
    <AppShell showRightPanel={false}>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-fadeIn">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-brand-950/40 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          {/* Background Glow */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-aurora-cyan/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Smartphone className="w-3.5 h-3.5" />
                <span>Nexa for Android {ANDROID_RELEASE.versionLabel} Available</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Download Nexa APK
              </h1>
              <p className="text-slate-400 text-sm sm:text-base max-w-xl">
                Experience ultra-fast WebRTC HD voice and video calling, native lock-screen call wake-ups, real-time messaging, and proximity sensor earpiece routing directly on your Android phone.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4">
                <a
                  href={ANDROID_RELEASE.downloadUrl}
                  download={ANDROID_RELEASE.fileName}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2.5 group"
                >
                  <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                  <span>Direct Download APK</span>
                  <span className="text-xs font-normal opacity-90">({ANDROID_RELEASE.fileSize})</span>
                </a>

                <a
                  href={ANDROID_RELEASE.directAppReleaseUrl}
                  download="app-release.apk"
                  className="px-5 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-sm font-semibold border border-slate-700 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Direct APK Mirror</span>
                </a>
              </div>
            </div>

            {/* App Icon / Device Graphic */}
            <div className="flex-shrink-0 flex flex-col items-center p-6 bg-slate-950/60 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-brand-600 to-aurora-cyan p-0.5 shadow-glow-brand flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-2xl flex items-center justify-center">
                  <Sparkles className="w-12 h-12 text-brand-400" />
                </div>
              </div>
              <p className="mt-3 font-bold text-white text-sm">Nexa Mobile</p>
              <p className="text-xs text-slate-400">Version {ANDROID_RELEASE.versionName}</p>
              <span className="mt-2 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">Signed & Verified</span>
            </div>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="p-2.5 w-fit rounded-xl bg-brand-500/10 text-brand-400">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">WebRTC HD Calling</h3>
            <p className="text-xs text-slate-400">Bi-directional peer-to-peer video & audio with automated TURN relay fallback.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="p-2.5 w-fit rounded-xl bg-emerald-500/10 text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Lock Screen Wake-Up</h3>
            <p className="text-xs text-slate-400">High-priority full-screen intent wakes your phone and plays custom ringtones.</p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2">
            <div className="p-2.5 w-fit rounded-xl bg-cyan-500/10 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Hardware Sensors</h3>
            <p className="text-xs text-slate-400">Dynamic proximity sensor dims display and switches audio to earpiece automatically.</p>
          </div>
        </div>

        {/* Step-by-Step Installation Guide */}
        <div className="rounded-3xl bg-slate-900/70 border border-slate-800 p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-brand-400" />
            <span>How to Install on Your Android Phone</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex gap-3.5 items-start">
              <div className="w-7 h-7 rounded-full bg-brand-600/20 text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0">1</div>
              <div>
                <h4 className="text-sm font-semibold text-white">Download the APK</h4>
                <p className="text-xs text-slate-400 mt-1">Tap the Direct Download button above to download <code className="text-brand-300">app-release.apk</code> to your device.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex gap-3.5 items-start">
              <div className="w-7 h-7 rounded-full bg-brand-600/20 text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0">2</div>
              <div>
                <h4 className="text-sm font-semibold text-white">Allow Installation</h4>
                <p className="text-xs text-slate-400 mt-1">If prompted by Chrome or your File Manager, enable <em>"Install unknown apps"</em> for this source in Settings.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex gap-3.5 items-start">
              <div className="w-7 h-7 rounded-full bg-brand-600/20 text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0">3</div>
              <div>
                <h4 className="text-sm font-semibold text-white">Tap Install</h4>
                <p className="text-xs text-slate-400 mt-1">Open the downloaded file and tap <strong>Install</strong> to complete setup.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800/80 flex gap-3.5 items-start">
              <div className="w-7 h-7 rounded-full bg-brand-600/20 text-brand-400 font-bold text-xs flex items-center justify-center flex-shrink-0">4</div>
              <div>
                <h4 className="text-sm font-semibold text-white">Grant Permissions</h4>
                <p className="text-xs text-slate-400 mt-1">Launch Nexa and grant <strong>Notifications</strong> and <strong>Camera/Microphone</strong> permissions for real-time calling.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Release Specifications */}
        <div className="p-6 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span className="font-semibold text-slate-300">Package:</span> <code className="text-slate-400">com.yash.nexa.social</code>
          </div>
          <div>
            <span className="font-semibold text-slate-300">Target OS:</span> Android 7.0 (API 24) – Android 14 (API 34)
          </div>
          <div>
            <span className="font-semibold text-slate-300">File:</span> {ANDROID_RELEASE.fileName} ({ANDROID_RELEASE.fileSize})
          </div>
          <a
            href={ANDROID_RELEASE.githubReleaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-medium"
          >
            <span>View Release on GitHub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </AppShell>
  );
};
