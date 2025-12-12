import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform, ActivityIndicator, Text, Alert, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Hugging Face backend URL
const WEB_APP_URL = 'https://ade-basirwfrd-csms-backend.hf.space';

export default function App() {
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState(false);
    const [downloading, setDownloading] = React.useState(false);
    const webViewRef = React.useRef(null);

    // Handle file downloads
    const handleDownload = async (url) => {
        try {
            setDownloading(true);

            // Extract filename from URL or use default
            const urlParts = url.split('/');
            let filename = urlParts[urlParts.length - 1] || 'report.pdf';
            if (!filename.includes('.')) {
                filename = 'CSMS_Report.pdf';
            }

            // Download file
            const downloadPath = FileSystem.cacheDirectory + filename;
            console.log('Downloading to:', downloadPath);

            const downloadResult = await FileSystem.downloadAsync(url, downloadPath);

            if (downloadResult.status === 200) {
                // Share/open the file
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadResult.uri, {
                        mimeType: 'application/pdf',
                        dialogTitle: 'Save or Share Report'
                    });
                } else {
                    Alert.alert('Download Complete', `File saved to: ${filename}`);
                }
            } else {
                Alert.alert('Download Failed', 'Unable to download the file. Please try again.');
            }
        } catch (err) {
            console.error('Download error:', err);
            Alert.alert('Download Error', err.message || 'Failed to download file');
        } finally {
            setDownloading(false);
        }
    };

    // Handle navigation requests (intercept downloads and external links)
    const handleShouldStartLoadWithRequest = (request) => {
        const { url } = request;

        // Check if this is a download request (PDF, report endpoints)
        if (url.includes('/projects/') && url.includes('/report')) {
            handleDownload(url);
            return false; // Prevent WebView from navigating
        }

        // Check for blob URLs or file downloads
        if (url.startsWith('blob:') || url.includes('download=') || url.endsWith('.pdf')) {
            handleDownload(url);
            return false;
        }

        // Allow navigation within the app
        if (url.startsWith(WEB_APP_URL) || url.startsWith('about:')) {
            return true;
        }

        // Open external links in device browser
        if (url.startsWith('http://') || url.startsWith('https://')) {
            Linking.openURL(url);
            return false;
        }

        return true;
    };

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

            {downloading && (
                <View style={styles.downloadingContainer}>
                    <ActivityIndicator size="large" color="#C41E3A" />
                    <Text style={styles.loadingText}>Downloading Report...</Text>
                </View>
            )}

            {error && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Failed to load app</Text>
                    <Text style={styles.errorSubtext}>Please check your internet connection</Text>
                </View>
            )}

            <WebView
                ref={webViewRef}
                source={{ uri: WEB_APP_URL }}
                style={[styles.webview, loading && styles.hidden]}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                    setLoading(false);
                    setError(true);
                }}
                onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                onFileDownload={({ nativeEvent }) => {
                    handleDownload(nativeEvent.downloadUrl);
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={false}
                scalesPageToFit={true}
                allowsFullscreenVideo={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                allowFileAccess={true}
                allowFileAccessFromFileURLs={true}
                allowUniversalAccessFromFileURLs={true}
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
    downloadingContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(20, 20, 20, 0.9)',
        zIndex: 20,
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
