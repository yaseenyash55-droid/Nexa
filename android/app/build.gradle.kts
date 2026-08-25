import java.util.Properties
import java.io.FileInputStream

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.gms.google-services")
}

val keyPropertiesFile = sequenceOf(
    rootProject.file("key.properties"),
    project.file("key.properties")
).firstOrNull { it.exists() }

val keyProperties = Properties()
keyPropertiesFile?.let { file ->
    file.inputStream().use { keyProperties.load(it) }
}

android {
    namespace = "com.nexa.social"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.nexa.social"
        minSdk = 26
        targetSdk = 36
        versionCode = 7
        versionName = "1.3.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        buildConfigField("String", "API_BASE_URL", "\"https://nexa-backend-in6s.onrender.com/api/\"")
        buildConfigField("String", "SOCKET_SERVER_URL", "\"https://nexa-backend-in6s.onrender.com\"")
        buildConfigField("String", "WEB_ORIGIN", "\"https://nexa-social-app.surge.sh\"")
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("KEYSTORE_FILE") ?: keyProperties.getProperty("storeFile") ?: "release-key.jks"
            val storePasswordProp = System.getenv("KEYSTORE_PASSWORD") ?: keyProperties.getProperty("storePassword") ?: "nexa2026release"
            val keyAliasProp = System.getenv("KEY_ALIAS") ?: keyProperties.getProperty("keyAlias") ?: "nexa-alias"
            val keyPasswordProp = System.getenv("KEY_PASSWORD") ?: keyProperties.getProperty("keyPassword") ?: "nexa2026release"

            val foundKeystore = listOf(
                file(storeFilePath),
                rootProject.file(storeFilePath),
                project.file(storeFilePath),
                project.file("release-key.jks"),
                rootProject.file("release-key.jks"),
                project.file("nexa-release.jks"),
                rootProject.file("nexa-release.jks")
            ).firstOrNull { it.exists() }

            if (foundKeystore != null) {
                storeFile = foundKeystore
                storePassword = storePasswordProp
                keyAlias = keyAliasProp
                keyPassword = keyPasswordProp
            }
        }
    }

    buildTypes {
        debug {
            isDebuggable = true
            isMinifyEnabled = false
            buildConfigField("String", "API_BASE_URL", "\"https://nexa-backend-in6s.onrender.com/api/\"")
            buildConfigField("String", "SOCKET_SERVER_URL", "\"https://nexa-backend-in6s.onrender.com\"")
        }
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            isReturnDefaultValues = true
        }
    }
}

tasks.withType<Test> {
    jvmArgs("-XX:+EnableDynamicAgentLoading")
}

dependencies {
    // Core AndroidX & UI
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")

    // Navigation Component
    val navVersion = "2.8.5"
    implementation("androidx.navigation:navigation-fragment-ktx:$navVersion")
    implementation("androidx.navigation:navigation-ui-ktx:$navVersion")

    // Coroutines & WorkManager
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // Security & Encrypted Preferences
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase Cloud Messaging (FCM)
    implementation("com.google.firebase:firebase-messaging-ktx:24.1.0")

    // Socket.IO Client for Real-time Messaging
    implementation("io.socket:socket.io-client:2.1.1") {
        exclude(group = "org.json", module = "json")
    }

    // Native WebRTC audio/video calling
    implementation("io.github.webrtc-sdk:android:144.7559.12")

    // Networking & Retrofit
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    // Image Loading
    implementation("io.coil-kt:coil:2.7.0")

    // Video Playback
    val media3Version = "1.5.0"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-common:$media3Version")

    // Unit Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("org.robolectric:robolectric:4.14.1")
    testImplementation("androidx.test:core:1.6.1")
    testImplementation("androidx.test.ext:junit:1.2.1")
    testImplementation("org.mockito:mockito-core:5.14.2")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
    testImplementation("org.json:json:20240303")
}
