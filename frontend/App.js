import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';

// Hugging Face backend URL
const WEB_APP_URL = 'https://ade-basirwfrd-csms-backend.hf.space';

export default function App() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);

    // For web platform, use iframe
    if (Platform.OS === 'web') {
        return (
            <View style={styles.container}>
                <iframe
                    src={WEB_APP_URL}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="CSMS App"
                />
            </View>
        );
    }

    // For mobile platforms, use WebView
    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {loading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#C41E3A" />
                    <Text style={styles.loadingText}>Loading CSMS...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Failed to load app</Text>
                    <Text style={styles.errorSubtext}>Please check your internet connection</Text>
                </View>
            )}

            <WebView
                source={{ uri: WEB_APP_URL }}
                style={[styles.webview, loading && styles.hidden]}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                    setLoading(false);
                    setError(true);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={false}
                scalesPageToFit={true}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#141414',
    },
    webview: {
        flex: 1,
    },
    hidden: {
        opacity: 0,
    },
    loadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#141414',
        zIndex: 10,
    },
    loadingText: {
        color: '#ffffff',
        marginTop: 16,
        fontSize: 16,
    },
    errorContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#141414',
        zIndex: 10,
    },
    errorText: {
        color: '#C41E3A',
        fontSize: 18,
        fontWeight: 'bold',
    },
    errorSubtext: {
        color: '#888',
        marginTop: 8,
    },
});
