plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val apiBaseUrl = providers.gradleProperty("apiBaseUrl").orElse(providers.environmentVariable("COLHER_DADOS_API_BASE_URL")).orElse("https://example.invalid").get()
require(apiBaseUrl.startsWith("https://")) { "apiBaseUrl must use HTTPS" }
android {
    namespace = "br.com.colherdados"
    compileSdk = 35
    defaultConfig {
        applicationId = "br.com.colherdados"
        minSdk = 28
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
