import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform, ActivityIndicator, Text, BackHandler, Animated, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

// Hugging Face backend URL
const WEB_APP_URL = 'https://ade-basirwfrd-csms-backend.hf.space';

// Modern Toast Component
const Toast = ({ visible, message, type = 'info' }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true })
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.timing(translateY, { toValue: 50, duration: 200, useNativeDriver: true })
            ]).start();
        }
    }, [visible]);

    const bgColor = type === 'success' ? '#46D369' : type === 'error' ? '#C41E3A' : '#333';

    return (
        <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }], backgroundColor: bgColor }]}>
            <Text style={styles.toastText}>{message}</Text>
        </Animated.View>
    );
};

export default function App() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });
    const [backPressCount, setBackPressCount] = useState(0);
    const webViewRef = useRef(null);
    const backPressTimer = useRef(null);

    // Show modern toast
    const showToast = (message, type = 'info', duration = 3000) => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast({ visible: false, message: '', type: 'info' }), duration);
    };

    // Request permissions on app start
    useEffect(() => {
        const requestPermissions = async () => {
            try {
                // Request media library permission for saving files
                const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
                if (mediaStatus !== 'granted') {
                    showToast('Storage permission needed to save files', 'error');
                }

                // Request camera permission for taking photos
                const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();

                // Request media picker permission
                const { status: mediaPickerStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

                if (mediaStatus === 'granted') {
                    showToast('Ready to use CSMS', 'success', 2000);
                }
            } catch (err) {
                console.log('Permission error:', err);
            }
        };

        if (Platform.OS !== 'web') {
            requestPermissions();
        }
    }, []);

    // Handle back button press
    useEffect(() => {
        if (Platform.OS === 'android') {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
                if (backPressCount === 0) {
                    setBackPressCount(1);
                    showToast('Press back again to exit', 'info', 2000);

                    backPressTimer.current = setTimeout(() => {
                        setBackPressCount(0);
                    }, 2000);

                    return true; // Prevent default back action
                } else {
                    // Exit app
                    BackHandler.exitApp();
                    return true;
                }
            });

            return () => {
                backHandler.remove();
                if (backPressTimer.current) clearTimeout(backPressTimer.current);
            };
        }
    }, [backPressCount]);

    // Handle file downloads - save to Downloads folder
    const handleDownload = async (url) => {
        try {
            setDownloading(true);
            showToast('Downloading report...', 'info');

            // Extract filename from URL
            const urlParts = url.split('/');
            let filename = 'CSMS_Report_' + new Date().toISOString().slice(0, 10) + '.pdf';

            // Download file to cache first
            const downloadPath = FileSystem.cacheDirectory + filename;
            const downloadResult = await FileSystem.downloadAsync(url, downloadPath);

            if (downloadResult.status === 200) {
                // Save to media library (Downloads folder)
                try {
                    const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
                    const album = await MediaLibrary.getAlbumAsync('Download');
                    if (album) {
                        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
                    } else {
                        await MediaLibrary.createAlbumAsync('Download', asset, false);
                    }
                    showToast('Report saved to Downloads!', 'success');
                } catch (saveError) {
                    // Fallback to share dialog
                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(downloadResult.uri, {
                            mimeType: 'application/pdf',
                            dialogTitle: 'Save Report'
                        });
                        showToast('Report ready to save', 'success');
                    }
                }
            } else {
                showToast('Download failed. Please try again.', 'error');
            }
        } catch (err) {
            console.error('Download error:', err);
            showToast('Download error: ' + (err.message || 'Unknown error'), 'error');
        } finally {
            setDownloading(false);
        }
    };

    // Handle messages from WebView (for photo/file picker)
    const handleMessage = async (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);

            if (data.type === 'pickImage') {
                const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                    // Send back to WebView
                    webViewRef.current?.injectJavaScript(`
                        window.postMessage(${JSON.stringify({ type: 'imageSelected', uri: result.assets[0].uri })}, '*');
                    `);
                    showToast('Photo selected!', 'success');
                }
            } else if (data.type === 'pickFile') {
                const result = await DocumentPicker.getDocumentAsync({
                    type: '*/*',
                    copyToCacheDirectory: true,
                });

                if (!result.canceled && result.assets[0]) {
                    webViewRef.current?.injectJavaScript(`
                        window.postMessage(${JSON.stringify({ type: 'fileSelected', uri: result.assets[0].uri, name: result.assets[0].name })}, '*');
                    `);
                    showToast('File selected!', 'success');
                }
            } else if (data.type === 'takePhoto') {
                const result = await ImagePicker.launchCameraAsync({
                    allowsEditing: true,
                    quality: 0.8,
                });

                if (!result.canceled && result.assets[0]) {
                    webViewRef.current?.injectJavaScript(`
                        window.postMessage(${JSON.stringify({ type: 'photoTaken', uri: result.assets[0].uri })}, '*');
                    `);
                    showToast('Photo captured!', 'success');
                }
            }
        } catch (err) {
            console.log('Message handling error:', err);
        }
    };

    // Handle navigation requests
    const handleShouldStartLoadWithRequest = (request) => {
        const { url } = request;

        // Check if this is a download request
        if (url.includes('/projects/') && url.includes('/report')) {
            handleDownload(url);
            return false;
        }

        if (url.startsWith('blob:') || url.includes('download=') || url.endsWith('.pdf')) {
            handleDownload(url);
            return false;
        }

        // Allow navigation within the app
        if (url.startsWith(WEB_APP_URL) || url.startsWith('about:') || url === 'about:blank') {
            return true;
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
                    <Text style={styles.loadingSubtext}>Please wait...</Text>
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
                onMessage={handleMessage}
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

            <Toast visible={toast.visible} message={toast.message} type={toast.type} />
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
        backgroundColor: 'rgba(20, 20, 20, 0.95)',
        zIndex: 20,
    },
    loadingText: {
        color: '#ffffff',
        marginTop: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    loadingSubtext: {
        color: '#888',
        marginTop: 8,
        fontSize: 14,
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
    toast: {
        position: 'absolute',
        bottom: 100,
        left: 20,
        right: 20,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    toastText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        textAlign: 'center',
    },
});
