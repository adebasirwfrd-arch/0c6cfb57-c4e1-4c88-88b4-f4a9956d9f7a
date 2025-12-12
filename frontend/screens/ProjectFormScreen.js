import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createProject } from '../services/api';
import { COLORS } from '../App';

export default function ProjectFormScreen() {
    const navigation = useNavigation();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: 'Ongoing',
    });

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            Alert.alert('Validation Error', 'Project name is required.');
            return;
        }

        setLoading(true);
        try {
            await createProject(formData);
            Alert.alert('Success', 'Project created successfully! All standard tasks have been generated.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error('Error creating project:', error);
            Alert.alert('Error', 'Failed to create project. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        navigation.goBack();
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.label}>Project Name *</Text>
            <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(v) => handleChange('name', v)}
                placeholder="Enter project name"
                placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(v) => handleChange('description', v)}
                placeholder="Enter project description"
                placeholderTextColor={COLORS.textSecondary}
                multiline
                numberOfLines={4}
            />

            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
                style={styles.input}
                value={formData.start_date}
                onChangeText={(v) => handleChange('start_date', v)}
                placeholder="e.g. 2024-01-15"
                placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
                style={styles.input}
                value={formData.end_date}
                onChangeText={(v) => handleChange('end_date', v)}
                placeholder="e.g. 2024-06-30"
                placeholderTextColor={COLORS.textSecondary}
            />

            <Text style={styles.label}>Status</Text>
            <View style={styles.statusRow}>
                {['Ongoing', 'Pending', 'Completed'].map(status => (
                    <TouchableOpacity
                        key={status}
                        style={[styles.statusOption, formData.status === status && styles.statusOptionActive]}
                        onPress={() => handleChange('status', status)}
                    >
                        <Text style={[styles.statusOptionText, formData.status === status && styles.statusOptionTextActive]}>
                            {status}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={loading}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
                    {loading ? (
                        <ActivityIndicator color={COLORS.text} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Project</Text>
                    )}
                </TouchableOpacity>
            </View>
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
    label: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: COLORS.card,
        borderRadius: 8,
        padding: 14,
        color: COLORS.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#333',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    statusOption: {
        backgroundColor: COLORS.card,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        marginRight: 10,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    statusOptionActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    statusOptionText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    statusOptionTextActive: {
        color: COLORS.text,
        fontWeight: 'bold',
    },
    buttonRow: {
        flexDirection: 'row',
        marginTop: 32,
        justifyContent: 'space-between',
    },
    cancelButton: {
        flex: 1,
        backgroundColor: COLORS.card,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#555',
    },
    cancelButtonText: {
        color: COLORS.textSecondary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    saveButton: {
        flex: 1,
        backgroundColor: COLORS.primary,
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    saveButtonText: {
        color: COLORS.text,
        fontWeight: 'bold',
        fontSize: 16,
    },
});
