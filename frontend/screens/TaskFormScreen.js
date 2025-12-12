import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { getTasks, updateTask, uploadTaskAttachment } from '../services/api';
import { COLORS } from '../App';

const STATUSES = ['Upcoming', 'In Progress', 'Completed', 'Overdue'];

export default function TaskFormScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const { taskId } = route.params;

    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        const fetchTask = async () => {
            try {
                const res = await getTasks();
                const found = res.data.find(t => t.id === taskId);
                setTask(found);
            } catch (error) {
                console.error('Error fetching task:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchTask();
    }, [taskId]);

    const handleStatusChange = (status) => {
        setTask(prev => ({ ...prev, status }));
    };

    const handleDescriptionChange = (description) => {
        setTask(prev => ({ ...prev, description }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateTask(taskId, { status: task.status, description: task.description });
            Alert.alert('Success', 'Task updated successfully.');
        } catch (error) {
            console.error('Error updating task:', error);
            Alert.alert('Error', 'Failed to update task.');
        } finally {
            setSaving(false);
        }
    };

    const handlePickFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
            if (result.canceled === false && result.assets && result.assets.length > 0) {
                setSelectedFile(result.assets[0]);
            }
        } catch (error) {
            console.error('Error picking file:', error);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            Alert.alert('No file selected', 'Please select a file first.');
            return;
        }

        setUploading(true);
        try {
            await uploadTaskAttachment(taskId, selectedFile.uri, selectedFile.name);
            Alert.alert('Success', 'File uploaded to Google Drive successfully!');
            setSelectedFile(null);
            // Refresh task to show new attachment
            const res = await getTasks();
            const found = res.data.find(t => t.id === taskId);
            setTask(found);
        } catch (error) {
            console.error('Error uploading file:', error);
            Alert.alert('Error', 'Failed to upload file.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!task) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Task not found</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* Task Info */}
            <View style={styles.infoCard}>
                <Text style={styles.taskCode}>{task.code}</Text>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskCategory}>{task.category}</Text>
            </View>

            {/* Status Selection */}
            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
                {STATUSES.map(status => (
                    <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, task.status === status && styles.statusOptionActive]}
                        onPress={() => handleStatusChange(status)}
                    >
                        <Text style={[styles.statusOptionText, task.status === status && styles.statusOptionTextActive]}>
                            {status}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Description */}
            <Text style={styles.label}>Notes / Description</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={task.description || ''}
                onChangeText={handleDescriptionChange}
                placeholder="Add notes..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={4}
            />

            {/* Save Task Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.saveButtonText}>Save Changes</Text>}
            </TouchableOpacity>

            {/* Attachments Section */}
            <Text style={styles.sectionTitle}>Attachments</Text>

            {/* Existing Attachments */}
            {task.attachments && task.attachments.length > 0 ? (
                <View style={styles.attachmentList}>
                    {task.attachments.map((att, idx) => (
                        <View key={idx} style={styles.attachmentItem}>
                            <Text style={styles.attachmentName}>📎 {att.filename}</Text>
                            <Text style={styles.attachmentDate}>{new Date(att.uploaded_at).toLocaleDateString()}</Text>
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={styles.noAttachments}>No attachments yet.</Text>
            )}

            {/* Upload New */}
            <TouchableOpacity style={styles.pickFileButton} onPress={handlePickFile}>
                <Text style={styles.pickFileButtonText}>📁 Select File</Text>
            </TouchableOpacity>

            {selectedFile && (
                <View style={styles.selectedFileCard}>
                    <Text style={styles.selectedFileName}>{selectedFile.name}</Text>
                    <TouchableOpacity style={styles.uploadButton} onPress={handleUpload} disabled={uploading}>
                        {uploading ? (
                            <ActivityIndicator color={COLORS.text} />
                        ) : (
                            <Text style={styles.uploadButtonText}>Upload to Drive</Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
    errorText: {
        color: COLORS.error,
        fontSize: 16,
    },
    infoCard: {
        backgroundColor: COLORS.card,
        padding: 16,
        borderRadius: 10,
        marginBottom: 20,
    },
    taskCode: {
        color: COLORS.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    taskTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 4,
    },
    taskCategory: {
        color: COLORS.textSecondary,
        fontSize: 13,
        marginTop: 4,
    },
    label: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    statusOption: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        marginRight: 8,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#333',
    },
    statusOptionActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    statusOptionText: {
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    statusOptionTextActive: {
        color: COLORS.text,
        fontWeight: 'bold',
    },
    input: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 14,
        color: COLORS.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#333',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: COLORS.success,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20,
    },
    saveButtonText: {
        color: COLORS.text,
        fontWeight: 'bold',
        fontSize: 15,
    },
    sectionTitle: {
        color: COLORS.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 28,
        marginBottom: 12,
    },
    attachmentList: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 12,
    },
    attachmentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    attachmentName: {
        color: COLORS.text,
        fontSize: 14,
    },
    attachmentDate: {
        color: COLORS.textSecondary,
        fontSize: 12,
    },
    noAttachments: {
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },
    pickFileButton: {
        backgroundColor: COLORS.card,
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#555',
    },
    pickFileButtonText: {
        color: COLORS.text,
        fontSize: 15,
    },
    selectedFileCard: {
        backgroundColor: COLORS.card,
        padding: 14,
        borderRadius: 8,
        marginTop: 12,
    },
    selectedFileName: {
        color: COLORS.text,
        marginBottom: 10,
    },
    uploadButton: {
        backgroundColor: COLORS.primary,
        padding: 12,
        borderRadius: 6,
        alignItems: 'center',
    },
    uploadButtonText: {
        color: COLORS.text,
        fontWeight: 'bold',
    },
});
