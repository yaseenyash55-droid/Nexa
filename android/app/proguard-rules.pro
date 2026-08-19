# Nexa ProGuard and R8 Optimization Rules

# Keep data models serialized with Gson
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.nexa.social.data.models.** { *; }
-keep class com.nexa.social.data.api.** { *; }

# Retrofit & OkHttp
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontwarn okhttp3.**
-dontwarn okio.**

# Socket.IO & Engine.IO
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }

# AndroidX Security Crypto & Tink
-keep class androidx.security.crypto.** { *; }
-dontwarn com.google.crypto.tink.**

# Firebase Messaging
-dontwarn com.google.firebase.**
-keep class com.google.firebase.messaging.** { *; }

# Coroutines & WorkManager
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keep class androidx.work.** { *; }
