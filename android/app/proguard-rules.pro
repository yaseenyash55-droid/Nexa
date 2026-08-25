# ==============================================================================
# Nexa Social - ProGuard & R8 Optimization & Minification Rules
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Data Models & Serialization (Gson / JSON)
# ------------------------------------------------------------------------------
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
    @com.google.gson.annotations.Expose <fields>;
}
-keep class com.nexa.social.data.models.** { *; }
-keep class com.nexa.social.data.api.** { *; }

# ------------------------------------------------------------------------------
# 2. WebRTC Native JNI & Media Pipeline
# ------------------------------------------------------------------------------
-keep class org.webrtc.** { *; }
-keepclasseswithmembernames class org.webrtc.** {
    native <methods>;
}
-dontwarn org.webrtc.**

# ------------------------------------------------------------------------------
# 3. Firebase Cloud Messaging (FCM) & Google Play Services
# ------------------------------------------------------------------------------
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-keepattributes *Annotation*,InnerClasses,EnclosingMethod

# ------------------------------------------------------------------------------
# 4. Networking: Retrofit 2, OkHttp 3 & Okio
# ------------------------------------------------------------------------------
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# ------------------------------------------------------------------------------
# 5. Real-Time Socket.IO & Engine.IO
# ------------------------------------------------------------------------------
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }

# ------------------------------------------------------------------------------
# 6. AndroidX Security Crypto & Google Tink
# ------------------------------------------------------------------------------
-keep class androidx.security.crypto.** { *; }
-dontwarn com.google.crypto.tink.**
-keep class com.google.crypto.tink.** { *; }

# ------------------------------------------------------------------------------
# 7. Kotlin Coroutines & AndroidX WorkManager
# ------------------------------------------------------------------------------
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembernames class kotlinx.coroutines.** {
    volatile <fields>;
}
-keep class androidx.work.** { *; }

# ------------------------------------------------------------------------------
# 8. Media3 / ExoPlayer & Coil Image Loader
# ------------------------------------------------------------------------------
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-keep class coil.** { *; }
-dontwarn coil.**
