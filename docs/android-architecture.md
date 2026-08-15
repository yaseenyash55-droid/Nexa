# Nexa Android Native Application Architecture

> Planned architecture only. The current `android/` folder is not a complete buildable or publishable Android application.

## 1. Overview
Nexa Android is a native Kotlin Jetpack Compose application designed for Android 8.0 (API 26) and newer.

## 2. Architecture & Networking
- **Architecture**: Single-Activity Jetpack Compose with unidirectional data flow (ViewModels, StateFlow).
- **Networking**: Retrofit + OkHttp connecting to Nexa backend REST APIs (`/api/`) and Socket.IO real-time server (`ws://...`).
- **Security**: Device-level token storage via EncryptedSharedPreferences / Android Keystore.
